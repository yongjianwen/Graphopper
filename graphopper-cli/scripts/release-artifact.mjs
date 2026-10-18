import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const packed = spawnSync('npm', ['pack', '--json', '--cache', '.npm-cache'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (packed.status !== 0) {
  process.stderr.write(packed.stderr);
  process.exitCode = packed.status ?? 1;
} else {
  const results = JSON.parse(packed.stdout);
  const filename = results[0].filename;
  const digest = createHash('sha256')
    .update(await readFile(filename))
    .digest('hex');
  const checksumPath = `${filename}.sha256`;
  await writeFile(checksumPath, `${digest}  ${filename}\n`, 'utf8');
  process.stdout.write(`${filename}\n${checksumPath}\n`);
}
