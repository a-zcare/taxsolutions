import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '../db';
import { hash } from '../security';
import { seal, unseal } from '../v2/crypto';
import { audit } from '../v2/audit';
import type { Actor } from '../v2/policy';
import { safeRequest, VideoError } from './http';
import { z } from 'zod';
import {assertOAuthBinding} from './oauth-policy';
export const oauthProvider = z.enum(['google', 'microsoft', 'zoom']);
type Name = z.infer<typeof oauthProvider>;
function config(name: Name) {
  const prefix = { google: 'GOOGLE', microsoft: 'MICROSOFT', zoom: 'ZOOM' }[
      name
    ],
    clientId = process.env[`${prefix}_CLIENT_ID`],
    secret = process.env[`${prefix}_CLIENT_SECRET`];
  if (
    !clientId ||
    !secret ||
    !(process.env.VIDEO_ENABLED_PROVIDERS ?? '').split(',').includes(name)
  )
    throw new VideoError('PROVIDER_DISABLED');
  let tenant = process.env.MICROSOFT_TENANT_ID ?? '';
  if (name === 'microsoft' && !/^[a-f0-9-]{36}$/i.test(tenant))
    throw new VideoError('INVALID_TENANT');
  tenant = encodeURIComponent(tenant);
  const endpoints = {
    google: {
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/calendar.events',
    },
    microsoft: {
      authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      scope:
        'offline_access https://graph.microsoft.com/OnlineMeetings.ReadWrite',
    },
    zoom: {
      authorize: 'https://zoom.us/oauth/authorize',
      token: 'https://zoom.us/oauth/token',
      scope:
        'meeting:write:meeting meeting:read:list_meetings meeting:read:meeting meeting:update:meeting meeting:delete:meeting',
    },
  }[name];
  const app = new URL(process.env.APP_URL ?? 'http://localhost:3000');
  if (process.env.APP_ENV === 'production' && app.protocol !== 'https:')
    throw new VideoError('HTTPS_REQUIRED');
  return {
    ...endpoints,
    clientId,
    secret,
    redirect: `${app.origin}/api/oauth/${name}/callback`,
  };
}
export async function beginOAuth(actor: Actor, raw: string) {
  const name = oauthProvider.parse(raw),
    c = config(name);
  const state = randomBytes(32).toString('hex'),
    verifier = randomBytes(48).toString('base64url'),
    binding = randomBytes(32).toString('hex');
  const session = (await cookies()).get('tax-session')?.value;
  if (!session) throw Error('UNAUTHORIZED');
  await db.oAuthFlow.create({
    data: {
      id: hash(state),
      staffId: actor.id,
      provider: name,
      sessionHash: hash(session),
      browserHash: hash(binding),
      verifierCiphertext: seal(verifier, `oauth-flow:${hash(state)}`),
      expiresAt: new Date(Date.now() + 10 * 60000),
    },
  });
  (await cookies()).set(`tax-oauth-${name}`, binding, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/api/oauth/${name}/callback`,
    maxAge: 600,
  });
  const u = new URL(c.authorize);
  u.search = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirect,
    response_type: 'code',
    scope: c.scope,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    ...(name === 'google' ? { access_type: 'offline', prompt: 'consent' } : {}),
  }).toString();
  return u.href;
}
const tokenBody = z.object({
  access_token: z.string().min(1).max(20000),
  refresh_token: z.string().min(1).max(20000).optional(),
  expires_in: z.number().min(30).max(86400).default(3600),
});
export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};
async function exchange(name: Name, params: URLSearchParams) {
  const c = config(name);
  params.set('client_id', c.clientId);
  if (name !== 'zoom') params.set('client_secret', c.secret);
  const body = tokenBody.parse(
    await safeRequest(c.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(name === 'zoom'
          ? {
              Authorization: `Basic ${Buffer.from(c.clientId + ':' + c.secret).toString('base64')}`,
            }
          : {}),
      },
      body: params,
    }),
  );
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  } satisfies Tokens;
}
export async function finishOAuth(raw: string, state: string, code: string) {
  const name = oauthProvider.parse(raw);
  if (!/^[a-f0-9]{64}$/.test(state) || !code || code.length > 4096)
    throw Error('INVALID');
  const binding = (await cookies()).get(`tax-oauth-${name}`)?.value;
  if (!binding) throw Error('UNAUTHORIZED');
  const flow = await db.$transaction(async (tx) => {
    const row = await tx.oAuthFlow.findUnique({ where: { id: hash(state) } });
    if(!row)throw Error('UNAUTHORIZED');
    const session=await tx.staffSession.findUnique({where:{id:row.sessionHash},include:{staff:true}});
    assertOAuthBinding(row,hash(binding),name,session);
    await tx.oAuthFlow.delete({ where: { id: row.id } });
    return row;
  });
  (await cookies()).delete({
    name: `tax-oauth-${name}`,
    path: `/api/oauth/${name}/callback`,
  });
  const tokens = await exchange(
    name,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config(name).redirect,
      code_verifier: unseal(flow.verifierCiphertext, `oauth-flow:${flow.id}`),
    }),
  );
  await db.$transaction(async (tx) => {
    const session = await tx.staffSession.findUnique({
      where: { id: flow.sessionHash },
      include: { staff: true },
    });
    if (!session || session.expiresAt < new Date() || !session.staff.active)
      throw Error('UNAUTHORIZED');
    const old = await tx.oAuthConnection.findUnique({
      where: { staffId_provider: { staffId: flow.staffId, provider: name } },
    });
    const id = old?.id ?? randomUUID();
    if (!tokens.refreshToken && old) {
      const previous = JSON.parse(
        unseal(old.tokenCiphertext, `oauth:${id}`),
      ) as Tokens;
      tokens.refreshToken = previous.refreshToken;
    }
    await tx.oAuthConnection.upsert({
      where: { staffId_provider: { staffId: flow.staffId, provider: name } },
      create: {
        id,
        staffId: flow.staffId,
        provider: name,
        tokenCiphertext: seal(JSON.stringify(tokens), `oauth:${id}`),
      },
      update: {
        tokenCiphertext: seal(JSON.stringify(tokens), `oauth:${id}`),
        enabled: true,
      },
    });
    await audit(tx, session.staff, 'OAUTH_CONNECTED', 'OAuthConnection', id);
  });
}
export async function accessToken(
  staffId: string,
  name: string,
  force = false,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740218)`;
      const row = await tx.oAuthConnection.findUnique({
        where: { staffId_provider: { staffId, provider: name } },
      });
      const staff = await tx.staff.findUnique({ where: { id: staffId } });
      if (!row?.enabled || !staff?.active)
        throw new VideoError('CONNECTION_DISABLED');
      let tokens = JSON.parse(
        unseal(row.tokenCiphertext, `oauth:${row.id}`),
      ) as Tokens;
      if (force || tokens.expiresAt < Date.now() + 60000) {
        if (!tokens.refreshToken) throw new VideoError('REAUTHORIZE_REQUIRED');
        const fresh = await exchange(
          oauthProvider.parse(name),
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
          }),
        );
        tokens = {
          ...fresh,
          refreshToken: fresh.refreshToken ?? tokens.refreshToken,
        };
        await tx.oAuthConnection.update({
          where: { id: row.id },
          data: {
            tokenCiphertext: seal(JSON.stringify(tokens), `oauth:${row.id}`),
          },
        });
      }
      return tokens.accessToken;
    },
    { timeout: 20000 },
  );
}
