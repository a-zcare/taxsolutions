import bcrypt from 'bcryptjs';
import { db } from '../db';
import { verifyTotp, unseal } from './crypto';
import { audit } from './audit';
const dummyHash = bcrypt.hash('non-user-dummy-password-no-authentication', 12);
export async function authenticate(
  email: string,
  password: string,
  code: string,
) {
  const staff = await db.staff.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  const valid = await bcrypt.compare(
    password,
    staff?.passwordHash ?? (await dummyHash),
  );
  if (!staff?.active || !valid) throw Error('UNAUTHORIZED');
  const secret = unseal(staff.totpCiphertext, `totp:${staff.id}`);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
    const fresh = await tx.staff.findUniqueOrThrow({ where: { id: staff.id } });
    if (
      !fresh.active ||
      fresh.passwordHash !== staff.passwordHash ||
      fresh.totpCiphertext !== staff.totpCiphertext
    )
      throw Error('UNAUTHORIZED');
    const counter = verifyTotp(secret, code, fresh.lastTotpCounter);
    if (counter === null) throw Error('UNAUTHORIZED');
    await tx.staff.update({
      where: { id: staff.id },
      data: { lastTotpCounter: counter },
    });
    await audit(tx, staff, 'LOGIN', 'Staff', staff.id);
    return { id: staff.id, role: staff.role };
  });
}
