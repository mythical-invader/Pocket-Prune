// peakMemory.js — the most RAM a running program has used (its "peak"), in MB.
// We read the PEAK counter the operating system keeps for every process, instead of sampling the
// current memory: a peak counter can't miss a short spike between two samples.
//   Windows: PeakWorkingSet64 of the process (read by a small PowerShell loop every 200 ms;
//            pidusage would need the `wmic` tool, which newer Windows 11 no longer has).
//   Linux:   VmHWM ("high water mark") in /proc/<pid>/status.
// Usage:  const watcher = watchPeakMemory(child.pid);  …program runs…  const mb = await watcher.stop();
// SRS: REQ-17 (peak RAM per file). Owner: Sibghatullah (WP-14).
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const SAMPLE_MS = 200;
const toMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

export function watchPeakMemory(pid) {
  let peakBytes = 0;
  const remember = (bytes) => {
    if (bytes > peakBytes) peakBytes = bytes;
  };

  if (process.platform === 'win32') {
    // One PowerShell process prints the peak every 200 ms until the program ends.
    const script =
      `$p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue; ` +
      `while ($p -and -not $p.HasExited) { $p.Refresh(); $p.PeakWorkingSet64; ` +
      `Start-Sleep -Milliseconds ${SAMPLE_MS} }`;
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    ps.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) remember(Number(line) || 0);
    });
    // The loop ends by itself when the program has exited; wait for its last numbers to arrive.
    const finished = new Promise((resolve) => {
      ps.on('close', resolve);
      ps.on('error', resolve); // no PowerShell → no RAM number, but the benchmark still works
    });
    return {
      async stop() {
        const timer = setTimeout(() => ps.kill(), 3000); // never wait more than 3 s
        await finished;
        clearTimeout(timer);
        return peakBytes ? toMb(peakBytes) : null;
      },
    };
  }

  // Linux / macOS: VmHWM is already the peak, in kB. (macOS has no /proc → null.)
  const read = () => {
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
      const kb = Number(status.match(/VmHWM:\s+(\d+)\s+kB/)?.[1] || 0);
      remember(kb * 1024);
    } catch {
      // the program has ended — keep the last value
    }
  };
  read();
  const timer = setInterval(read, SAMPLE_MS);
  return {
    async stop() {
      clearInterval(timer);
      return peakBytes ? toMb(peakBytes) : null;
    },
  };
}
