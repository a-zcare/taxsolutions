import { db } from '../src/lib/db';
import { prepareTestOwner } from '../tests/fixtures';
await prepareTestOwner();
await db.$disconnect();
console.log('Synthetic MFA owner prepared in isolated test database.');
