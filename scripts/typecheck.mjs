import './windows-profile.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Vinext and Next write different route declarations to .next/types. Refresh
// Next's declarations before tsc so switching build targets cannot mix them.
for (const args of [
  [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'typegen', '--webpack'],
  [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '--noEmit'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
