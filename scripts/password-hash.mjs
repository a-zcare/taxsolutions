import bcrypt from 'bcryptjs';
import readline from 'node:readline';
if (!process.stdin.isTTY) throw new Error('Run in an interactive terminal');
process.stdout.write('New admin password (hidden, at least 14 characters): ');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
let password = '';
process.stdin.on('keypress', async (str, key) => {
  if (key.ctrl && key.name === 'c') process.exit(1);
  if (key.name === 'return') {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    if (password.length < 14) {
      console.error('\nPassword must contain at least 14 characters');
      process.exit(1);
    }
    console.log(
      '\nADMIN_PASSWORD_HASH_B64=' +
        Buffer.from(await bcrypt.hash(password, 12)).toString('base64'),
    );
    process.exit(0);
  } else if (key.name === 'backspace') password = password.slice(0, -1);
  else if (str && !key.ctrl) password += str;
});
