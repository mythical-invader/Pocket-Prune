// runCommand.js — runs ONE external program (llama.cpp tool, Python converter, hf) safely.
// - spawn(program, [args]) with NO shell: arguments are passed as-is, so a model name or path
//   can never be read as an extra command (no "command injection").
// - every run has a time limit; a program that is too slow is stopped (E-TIME-01).
// - every output line is passed to onLine(), so the pipeline can save it as a job log line.
// - temporary files of every tool go to data/tmp (next to our data), never to the system
//   temp folder — on Windows that is on C:, and model work must stay on the data drive.
// SRS: REQ-14 (tool output to the job log), REQ-15 (time limits). Owner: Sibghatullah (WP-04).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { settings } from '../config/settings.js';
import { appError } from './errors.js';

const KEEP_LINES = 200; // only the last 200 lines are kept in memory (REQ-26 shows 200)

export function runCommand(program, args, options = {}) {
  const { cwd, env, timeoutMs = 60_000, onLine = () => {} } = options;
  const started = Date.now();
  const tmpDir = path.join(settings.dataDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd,
      // TMP/TEMP = Windows, TMPDIR = Linux/macOS. Python, hf and llama.cpp all respect these.
      env: { ...process.env, TMP: tmpDir, TEMP: tmpDir, TMPDIR: tmpDir, ...env },
      stdio: ['ignore', 'pipe', 'pipe'], // no keyboard input: tools must never wait for it
      windowsHide: true, // no pop-up console windows on Windows
    });

    const lines = []; // last lines of stdout + stderr together, for the log
    let stdout = ''; // full normal output (e.g. the text a smoke test generated)
    let timedOut = false;

    // Output arrives in chunks; split it into lines. Progress bars use \r, so split on that too.
    const rest = { stdout: '', stderr: '' }; // unfinished last line of each stream
    const collect = (stream) => (chunk) => {
      const parts = (rest[stream] + chunk.toString()).split(/\r\n|\n|\r/);
      rest[stream] = parts.pop();
      for (const line of parts) addLine(line, stream);
      if (stream === 'stdout') stdout += chunk.toString();
    };
    const addLine = (line, stream) => {
      if (!line.trim()) return;
      lines.push(line);
      if (lines.length > KEEP_LINES) lines.shift();
      onLine(line, stream);
    };

    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill(); // Windows: ends the process at once; Linux: sends SIGTERM
    }, timeoutMs);

    // 'error' = the program could not even start (usually: not installed / wrong path).
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(appError('E-TOOL-01', { message: `Could not start ${program}: ${err.message}` }));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      addLine(rest.stdout, 'stdout');
      addLine(rest.stderr, 'stderr');
      const durationSec = (Date.now() - started) / 1000;
      if (timedOut) {
        const minutes = Math.round(timeoutMs / 6000) / 10;
        return reject(appError('E-TIME-01', { message: `Stopped after ${minutes} min.` }));
      }
      resolve({ code, stdout, lines, durationSec });
    });
  });
}
