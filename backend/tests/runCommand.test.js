// runCommand.test.js — runs tiny Node scripts as "fake tools" (no internet, no llama.cpp),
// to check output lines, exit codes, the time limit and a missing program. Owner: Sibghatullah.
import { runCommand } from '../utils/runCommand.js';

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

  it('reports a missing program as E-TOOL-01', async () => {
    await expect(runCommand('this-program-does-not-exist-123', [])).rejects.toMatchObject({
      code: 'E-TOOL-01',
    });
  });
});
