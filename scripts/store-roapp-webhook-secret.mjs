// Root-only: read the shared webhook secret from non-echoing stdin.
// Never print it or accept it as a command-line argument.
import { createInterface } from 'node:readline';
import { readFile, writeFile, rename, copyFile, chmod } from 'node:fs/promises';
if (process.getuid?.() !== 0) throw new Error('root_required');
const input = createInterface({ input: process.stdin, terminal: false });
const secret = await new Promise(resolve => input.once('line', resolve));
input.close();
if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('invalid_secret');
const file = '/etc/white-gloss/environment';
const backup = `/var/backups/white-gloss/environment-before-webhook-${Date.now()}`;
await copyFile(file, backup);
await chmod(backup, 0o600);
const text = (await readFile(file, 'utf8')).split(/\r?\n/)
  .filter(line => line.split('=')[0].trim() !== 'ROAPP_WEBHOOK_SECRET');
text.push(`ROAPP_WEBHOOK_SECRET=${secret}`);
await writeFile(file + '.webhook', text.join('\n') + '\n', { mode: 0o600 });
await rename(file + '.webhook', file);
console.log('webhook_secret_saved');
