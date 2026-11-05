import { spawn } from 'node:child_process';
import { db } from '../src/lib/db';
import { requireTestDatabase } from './fixtures';
requireTestDatabase();
const before = Date.now();
const child = spawn(process.execPath, ['dist/worker.mjs'], {
  env: process.env,
  stdio: ['ignore', 'ignore', 'inherit'],
});
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null)
      throw Error('Bundled worker exited before readiness');
    const row = await db.setting.findUnique({
      where: { key: 'worker.heartbeat' },
    });
    const at = (row?.value as { at?: string })?.at;
    if (at && Date.parse(at) >= before && Date.parse(at) <= Date.now()) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw Error('Bundled worker did not update heartbeat');
  console.log(
    'PASS bundled Node ESM worker runs and updates database heartbeat',
  );
} finally {
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once('exit', () => resolve());
  });
  clearTimeout(timer);
  await db.$disconnect();
}
