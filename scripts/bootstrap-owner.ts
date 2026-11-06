import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db';
import { newTotpSecret, seal } from '../src/lib/v2/crypto';
// Run through stdin: never pass passwords/TOTP secrets as shell arguments.
let raw = '';
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 4096) throw Error('Input too large');
}
const input = JSON.parse(raw) as {
  email: string;
  name: string;
  password: string;
  totpSecret?: string;
};
if (
  !input.email ||
  !input.name ||
  input.password?.length < 14 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
)
  throw Error(
    'Valid email/name and password of at least 14 characters required',
  );
const id = randomUUID(),
  secret = input.totpSecret ?? newTotpSecret();
await db.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
  if (await tx.staff.count({ where: { role: 'OWNER' } }))
    throw Error('Owner already exists; use staff administration');
  await tx.staff.create({
    data: {
      id,
      email: input.email.toLowerCase(),
      name: input.name,
      role: 'OWNER',
      passwordHash: await bcrypt.hash(input.password, 12),
      totpCiphertext: seal(secret, `totp:${id}`),
    },
  });
});
if (!input.totpSecret) {
  console.log(
    'Store this TOTP provisioning URI offline in an authenticator. It is shown only once:',
  );
  console.log(
    `otpauth://totp/TaxSolutions:${encodeURIComponent(input.email)}?secret=${secret}&issuer=TaxSolutions&algorithm=SHA1&digits=6&period=30`,
  );
} else console.log('Owner created with supplied TOTP secret.');
await db.$disconnect();
