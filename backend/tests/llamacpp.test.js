// llamacpp.test.js — checks the exact llama.cpp commands we build and how results are read.
// runCommand is mocked, so no llama.cpp is needed (CI has none). Owner: Sibghatullah (WP-04).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import { runCommand } from '../utils/runCommand.js';
import { checkInstalled, convertToF16, quantize, smokeTest, toolPath } from '../worker/llamacpp.js';

vi.mock('../utils/runCommand.js', () => ({ runCommand: vi.fn() }));

const ok = (extra = {}) => ({ code: 0, stdout: '', lines: [], durationSec: 1.5, ...extra });

beforeEach(() => {
  runCommand.mockReset();
  settings.llamaCppDir = path.join(os.tmpdir(), 'llama-test');
  settings.llamaCppRef = 'b12376';
});

describe('convertToF16', () => {
  it('runs the converter with the venv Python and --outtype f16', async () => {
    runCommand.mockResolvedValue(ok());
    const result = await convertToF16('models/m', 'out-F16.gguf');

    const [program, args, options] = runCommand.mock.calls[0];
    expect(program).toMatch(/venv[\\/](Scripts|bin)[\\/]python/);
    expect(args.slice(1)).toEqual(['models/m', '--outfile', 'out-F16.gguf', '--outtype', 'f16']);
    expect(args[0]).toMatch(/convert_hf_to_gguf\.py$/);
    expect(options.timeoutMs).toBe(settings.timeoutsMin.convert * 60_000);
    expect(result.durationSec).toBe(1.5);
  });

  it('throws E-CONV-01 when the converter fails', async () => {
    runCommand.mockResolvedValue(ok({ code: 1 }));
    await expect(convertToF16('m', 'o')).rejects.toMatchObject({ code: 'E-CONV-01' });
  });
});

describe('quantize', () => {
  it('runs llama-quantize <in> <out> <level>', async () => {
    runCommand.mockResolvedValue(ok());
    await quantize('a-F16.gguf', 'a-Q4_K_M.gguf', 'Q4_K_M');

    const [program, args] = runCommand.mock.calls[0];
    expect(program).toBe(toolPath('llama-quantize'));
    expect(args).toEqual(['a-F16.gguf', 'a-Q4_K_M.gguf', 'Q4_K_M']);
  });

  it('refuses an unknown level without running anything (E-LVL-01)', async () => {
    await expect(quantize('a', 'b', 'Q2_K')).rejects.toMatchObject({ code: 'E-LVL-01' });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('throws E-QNT-01 when llama-quantize fails', async () => {
    runCommand.mockResolvedValue(ok({ code: 1 }));
    await expect(quantize('a', 'b', 'Q5_K_M')).rejects.toMatchObject({ code: 'E-QNT-01' });
  });
});

describe('smokeTest', () => {
  it('uses llama-completion with seed 42, temp 0, 32 tokens, CPU only, no chat', async () => {
    runCommand.mockResolvedValue(ok({ stdout: ' Paris.\n' }));
    const result = await smokeTest('a.gguf');

    const [program, args] = runCommand.mock.calls[0];
    expect(program).toBe(toolPath('llama-completion'));
    expect(args).toEqual(
      expect.arrayContaining(['-m', 'a.gguf', '-n', '32', '--seed', '42', '--temp', '0'])
    );
    expect(args).toEqual(expect.arrayContaining(['-ngl', '0', '-no-cnv']));
    expect(result).toMatchObject({ passed: true, output: 'Paris.' });
  });

  it('fails when the tool prints nothing', async () => {
    runCommand.mockResolvedValue(ok({ stdout: '   ' }));
    expect((await smokeTest('a.gguf')).passed).toBe(false);
  });

  it('fails when the tool exits with an error', async () => {
    runCommand.mockResolvedValue(ok({ code: 1, stdout: 'text' }));
    expect((await smokeTest('a.gguf')).passed).toBe(false);
  });

  it('fails (does not crash) when it is too slow', async () => {
    runCommand.mockRejectedValue(Object.assign(new Error('slow'), { code: 'E-TIME-01' }));
    expect(await smokeTest('a.gguf')).toMatchObject({ passed: false, output: 'Timed out.' });
  });
});

describe('checkInstalled', () => {
  it('accepts the pinned tag and rejects anything else (E-TOOL-01)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llama-'));
    settings.llamaCppDir = dir;
    expect(() => checkInstalled()).toThrow(expect.objectContaining({ code: 'E-TOOL-01' }));

    fs.writeFileSync(path.join(dir, 'VERSION'), 'b12376');
    expect(checkInstalled()).toBe('b12376');

    settings.llamaCppRef = 'b99999';
    expect(() => checkInstalled()).toThrow(expect.objectContaining({ code: 'E-TOOL-01' }));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
