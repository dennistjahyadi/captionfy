/**
 * Render every ad to `out/`, named the way they should be uploaded.
 *
 * `npm run render:all`
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ADS = [
  { id: 'offline', out: 'out/wordburn-01-offline.mp4' },
  { id: 'pay-once', out: 'out/wordburn-02-pay-once.mp4' },
  { id: 'emphasis', out: 'out/wordburn-03-emphasis.mp4' },
];

mkdirSync('out', { recursive: true });

for (const ad of ADS) {
  console.log(`\n── ${ad.id} → ${ad.out}`);
  execFileSync('npx', ['remotion', 'render', 'src/index.ts', ad.id, ad.out, '--log=error'], {
    stdio: 'inherit',
  });
}

console.log('\nDone. Upload the files in out/.');
