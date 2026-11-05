import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
function key() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw || !/^[A-Za-z0-9+/]{43}=$/.test(raw))
    throw Error('ENCRYPTION_KEY_REQUIRED');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw Error('ENCRYPTION_KEY_REQUIRED');
  return key;
}
export function seal(value: string, context: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), nonce);
  cipher.setAAD(Buffer.from(context));
  const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    nonce.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    bytes.toString('base64url'),
  ].join('.');
}
export function unseal(value: string, context: string) {
  const [v, n, t, c, ...extra] = value.split('.');
  if (v !== 'v1' || !n || !t || !c || extra.length)
    throw Error('INVALID_CIPHERTEXT');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(n, 'base64url'),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(t, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(c, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret() {
  let bits = '';
  for (const b of randomBytes(20)) bits += b.toString(2).padStart(8, '0');
  return bits
    .match(/.{5}/g)!
    .map((b) => alphabet[parseInt(b, 2)])
    .join('');
}
function decode(secret: string) {
  if (!/^[A-Z2-7]{16,128}$/.test(secret)) throw Error('INVALID_TOTP_SECRET');
  const bits = [...secret]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0'))
    .join('');
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
}
export function totp(secret: string, now = Date.now(), digits = 6) {
  const counter = BigInt(Math.floor(now / 30000));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decode(secret)).update(buffer).digest();
  const offset = digest.at(-1)! & 15;
  return String(
    (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, '0');
}
export function verifyTotp(
  secret: string,
  code: string,
  last: bigint,
  now = Date.now(),
) {
  if (!/^\d{6}$/.test(code)) return null;
  for (const delta of [-1, 0, 1]) {
    const time = now + delta * 30000;
    const counter = BigInt(Math.floor(time / 30000));
    if (counter <= last) continue;
    const expected = Buffer.from(totp(secret, time));
    if (timingSafeEqual(expected, Buffer.from(code))) return counter;
  }
  return null;
}
