// llamacpp.test.js — checks the exact llama.cpp commands we build and how results are read.
// runCommand is mocked, so no llama.cpp is needed (CI has none). Owner: Sibghatullah (WP-04).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import { runCommand } from '../utils/runCommand.js';
import {
  benchmark,
  checkInstalled,
  convertToF16,
  quantize,
  smokeTest,
  toolPath,
} from '../worker/llamacpp.js';

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

  it('writes a fixed model name, so the file does not depend on the folder name', async () => {
    runCommand.mockResolvedValue(ok());
    await convertToF16('models/m', 'o.gguf', { modelName: 'SmolLM2-135M-Instruct' });
    expect(runCommand.mock.calls[0][1].slice(-2)).toEqual([
      '--model-name',
      'SmolLM2-135M-Instruct',
    ]);
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

describe('benchmark (WP-14)', () => {
  afterEach(() => {
    settings.demoMode = false;
    settings.benchThreads = 0;
  });

  it('runs llama-bench: pp512 + tg128, 3 repeats, CPU only, JSON output', async () => {
    runCommand.mockResolvedValue(ok({ stdout: '[{"n_prompt":512}]' }));
    const result = await benchmark('a.gguf', { runs: 3 });

    const [program, args] = runCommand.mock.calls[0];
    expect(program).toBe(toolPath('llama-bench'));
    expect(args).toEqual([
      '-m',
      'a.gguf',
      '-p',
      '512',
      '-n',
      '128',
      '-r',
      '3',
      '-ngl',
      '0',
      '-o',
      'json',
    ]);
    expect(result.tests).toEqual([{ n_prompt: 512 }]);
    expect(result.sizes).toEqual({ prompt: 512, gen: 128 });
  });

  it('uses the short test in demo mode and a fixed thread count when set', async () => {
    settings.demoMode = true;
    settings.benchThreads = 8;
    runCommand.mockResolvedValue(ok({ stdout: '[]' }));
    await benchmark('a.gguf');
    const [, args] = runCommand.mock.calls[0];
    expect(args).toEqual(expect.arrayContaining(['-p', '128', '-n', '32', '-t', '8']));
  });

  it('sends only stderr lines to the job log (stdout is the JSON answer)', async () => {
    runCommand.mockResolvedValue(ok({ stdout: '[]' }));
    const logged = [];
    await benchmark('a.gguf', { onLine: (l) => logged.push(l) });
    const { onLine } = runCommand.mock.calls[0][2];
    onLine('loading model', 'stderr');
    onLine('[{"avg_ts": 1}]', 'stdout');
    expect(logged).toEqual(['loading model']);
  });

  it('throws E-BENCH-01 when llama-bench fails or prints no valid JSON', async () => {
    runCommand.mockResolvedValue(ok({ code: 1 }));
    await expect(benchmark('a.gguf')).rejects.toMatchObject({ code: 'E-BENCH-01' });
    runCommand.mockResolvedValue(ok({ stdout: 'not json' }));
    await expect(benchmark('a.gguf')).rejects.toMatchObject({ code: 'E-BENCH-01' });
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
