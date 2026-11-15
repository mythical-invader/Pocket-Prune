// peakMemory.test.js — a REAL check of the RAM watcher (no mocks): a small Node program fills
// ~200 MB of memory, holds it for 2 s and exits; the watcher must report at least 150 MB.
// Works on Windows (PowerShell PeakWorkingSet64) and on Linux CI (/proc VmHWM).
// Owner: Sibghatullah (WP-14).
import { spawn } from 'node:child_process';
import { watchPeakMemory } from '../utils/peakMemory.js';

const FILL_200_MB =
  'const b = Buffer.alloc(200 * 1024 * 1024, 1); setTimeout(() => b.length, 2000);';

describe('watchPeakMemory', () => {
  it('reports the peak RAM of a running program', async () => {
    const child = spawn(process.execPath, ['-e', FILL_200_MB], { stdio: 'ignore' });
    await new Promise((resolve) => child.once('spawn', resolve));
    const watcher = watchPeakMemory(child.pid);

    await new Promise((resolve) => child.once('exit', resolve));
    const peakMb = await watcher.stop();

    expect(peakMb).toBeGreaterThan(150);
    expect(peakMb).toBeLessThan(1000);
  }, 15_000);
});
