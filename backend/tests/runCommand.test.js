// runCommand.test.js — runs tiny Node scripts as "fake tools" (no internet, no llama.cpp),
// to check output lines, exit codes, the time limit and a missing program. Owner: Sibghatullah.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { runCommand } from '../utils/runCommand.js';

// Use a throw-away data folder so the test never creates data/tmp in the repo.
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-run-'));
beforeAll(() => {
  settings.dataDir = tmpData;
});
afterAll(() => fs.rmSync(tmpData, { recursive: true, force: true }));

const node = process.execPath; // the Node program itself — exists on every machine and in CI
const script = (code) => ['-e', code];

describe('runCommand', () => {
  it('returns the exit code, stdout and every output line', async () => {
    const seen = [];
    const result = await runCommand(
      node,
      script("console.log('one'); console.error('two'); process.stdout.write('three')"),
      { onLine: (line, stream) => seen.push(`${stream}:${line}`) }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('one\nthree');
    expect(seen).toContain('stdout:one');
    expect(seen).toContain('stderr:two');
    expect(seen).toContain('stdout:three'); // last line without a newline is not lost
    expect(result.durationSec).toBeGreaterThanOrEqual(0);
  });

  it('reports a non-zero exit code instead of throwing', async () => {
    const result = await runCommand(node, script('process.exit(3)'));
    expect(result.code).toBe(3);
  });

  it('passes arguments exactly, without a shell', async () => {
    // With a shell, "; echo hacked" would run as a second command. Here it is just text.
    const tricky = 'model; echo hacked & del x';
    const result = await runCommand(node, ['-e', 'console.log(process.argv[1])', tricky]);
    expect(result.stdout.trim()).toBe(tricky);
  });

  it('stops a program that is too slow (E-TIME-01)', async () => {
    const started = Date.now();
    await expect(
      runCommand(node, script('setTimeout(() => {}, 10000)'), { timeoutMs: 300 })
    ).rejects.toMatchObject({ code: 'E-TIME-01' });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('on a timeout also stops the programs the tool started (process tree)', async () => {
    // Like hf.exe → python.exe: the "tool" starts a child that would write a file after 1.5 s.
    // On Windows the child is "detached" (not tied to the tool), so stopping only the tool
    // would leave it running; on Linux children are never tied to their parent anyway.
    const marker = path.join(tmpData, 'grandchild-was-here.txt');
    const grandchild = `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 1500)`;
    const detached = process.platform === 'win32';
    const tool = `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore', detached: ${detached} }); setTimeout(() => {}, 10000)`;

    await expect(runCommand(node, script(tool), { timeoutMs: 500 })).rejects.toMatchObject({
      code: 'E-TIME-01',
    });
    await new Promise((resolve) => setTimeout(resolve, 2500)); // longer than the grandchild's 1.5 s
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('gives every tool a temp folder inside the data folder (never the system temp on C:)', async () => {
    const result = await runCommand(
      node,
      script('console.log(process.env.TEMP, process.env.TMPDIR)')
    );
    const expected = path.join(settings.dataDir, 'tmp');
    expect(result.stdout.trim()).toBe(`${expected} ${expected}`);
  });

  it('reports a missing program as E-TOOL-01', async () => {
    await expect(runCommand('this-program-does-not-exist-123', [])).rejects.toMatchObject({
      code: 'E-TOOL-01',
    });
  });
});
