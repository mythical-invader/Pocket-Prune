// pipeline.test.js — checks the order of stages, the saved variants and the failure rules of
// pipeline.js. The downloader and llama.cpp adapter are mocked (no internet, no llama.cpp);
// the mocks write tiny files so sizes and SHA-256 are real. Free disk is mocked too.
// Owner: Sibghatullah (WP-06; clean-up and disk reserve WP-13; quality + F16 deletion WP-16).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import { downloadModel } from '../worker/downloader.js';
import { convertToF16, quantize, smokeTest } from '../worker/llamacpp.js';
import { runPipeline } from '../worker/pipeline.js';
import { getFreeDiskMb } from '../utils/systemInfo.js';
import { benchmarkFile, checkDatasets, measureQuality } from '../worker/evaluator.js';

vi.mock('../worker/downloader.js', () => ({ downloadModel: vi.fn() }));
vi.mock('../utils/systemInfo.js', () => ({ getFreeDiskMb: vi.fn() }));
// Keep the real addQuality(); replace the parts that run tools or read the test files.
vi.mock('../worker/evaluator.js', async (original) => ({
  ...(await original()),
  benchmarkFile: vi.fn(),
  checkDatasets: vi.fn(),
  measureQuality: vi.fn(),
}));

const METRICS = { tpsPrompt: 990, tpsGen: 200, peakRamMb: 170, runs: 3, unstable: false };
const QUALITY = {
  perplexity: 19.87,
  perplexityStd: 0.37,
  taskAccuracy: 41.5,
  taskAccuracyMargin: 4.8,
  taskName: 'HellaSwag',
  settings: { chunks: 100, tasks: 400 },
};
vi.mock('../worker/llamacpp.js', () => ({
  checkInstalled: vi.fn(() => 'b12376'),
  convertToF16: vi.fn(),
  quantize: vi.fn(),
  smokeTest: vi.fn(),
}));

const job = {
  _id: 'test-job',
  model: { hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct', revision: '12fd25f7abc' },
  quantLevels: ['Q5_K_M', 'Q4_K_M'],
};

// Collects what the pipeline reports, instead of printing it or writing to MongoDB.
function recorder() {
  const stages = [];
  const logs = [];
  return {
    stages,
    logs,
    stage: async (status, text) => stages.push(`${status}: ${text}`),
    log: async (message, level = 'info') => logs.push({ message, level }),
  };
}

let tmp;
beforeEach(() => {
  vi.clearAllMocks();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-pipe-'));
  settings.dataDir = tmp;
  downloadModel.mockResolvedValue({
    dir: path.join(tmp, 'models', 'm'),
    reused: false,
    durationSec: 3,
  });
  convertToF16.mockImplementation(async (dir, out) => {
    fs.writeFileSync(out, 'f16-bytes');
    return { durationSec: 10 };
  });
  quantize.mockImplementation(async (f16, out, level) => {
    fs.writeFileSync(out, `${level}-bytes`);
    return { durationSec: 1 };
  });
  smokeTest.mockResolvedValue({ passed: true, output: 'Paris.', durationSec: 0.5 });
  getFreeDiskMb.mockResolvedValue(100_000); // plenty of free disk unless a test says otherwise
  benchmarkFile.mockResolvedValue(METRICS);
  checkDatasets.mockResolvedValue({ wikitext: 'wiki.test.raw', hellaswag: 'hellaswag.txt' });
  measureQuality.mockResolvedValue(QUALITY);
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('runPipeline (real pipeline, mocked tools)', () => {
  it('runs download → convert → quantize → validate and returns F16 + every level', async () => {
    const report = recorder();
    const result = await runPipeline(job, report);

    expect(report.stages.map((s) => s.split(':')[0])).toEqual([
      'DOWNLOADING',
      'CONVERTING',
      'QUANTIZING',
      'QUANTIZING',
      'VALIDATING',
      'VALIDATING',
      'VALIDATING',
      'BENCHMARKING',
      'BENCHMARKING',
      'BENCHMARKING',
      'EVALUATING',
      'EVALUATING',
      'EVALUATING',
    ]);
    expect(result.variants.map((v) => v.level)).toEqual(['F16', 'Q5_K_M', 'Q4_K_M']);

    const q4 = result.variants[2];
    expect(q4.filePath).toBe(
      path.join(tmp, 'artifacts', 'test-job', 'SmolLM2-135M-Instruct-Q4_K_M.gguf')
    );
    expect(q4.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(q4.fileSizeMb).toBeGreaterThanOrEqual(0);
    expect(q4).toMatchObject({ smokePassed: true, smokeOutput: 'Paris.', durationSec: 1 });
    expect(convertToF16.mock.calls[0][2].modelName).toBe('SmolLM2-135M-Instruct');
    expect(downloadModel).toHaveBeenCalledWith(
      job.model.hfRepoId,
      '12fd25f7abc',
      expect.anything()
    );
  });

  it('keeps going when one level fails to quantize, and removes its half-written file', async () => {
    quantize.mockImplementation(async (f16, out, level) => {
      fs.writeFileSync(out, 'partial');
      if (level === 'Q5_K_M') throw Object.assign(new Error('boom'), { code: 'E-QNT-01' });
      return { durationSec: 1 };
    });
    const report = recorder();
    const result = await runPipeline(job, report);

    expect(result.variants.map((v) => v.level)).toEqual(['F16', 'Q4_K_M']);
    expect(
      fs.existsSync(path.join(tmp, 'artifacts', 'test-job', 'SmolLM2-135M-Instruct-Q5_K_M.gguf'))
    ).toBe(false);
    expect(report.logs).toContainEqual({
      message: 'Q5_K_M failed (E-QNT-01): boom',
      level: 'error',
    });
  });

  it('fails with E-VAL-01 when no quantized file passes the smoke test', async () => {
    smokeTest.mockImplementation(async (file) =>
      file.endsWith('F16.gguf') ? { passed: true, output: 'ok' } : { passed: false, output: '' }
    );
    await expect(runPipeline(job, recorder())).rejects.toMatchObject({ code: 'E-VAL-01' });
  });

  it('stops the job when conversion fails (nothing can be quantized without F16)', async () => {
    convertToF16.mockRejectedValue(Object.assign(new Error('bad'), { code: 'E-CONV-01' }));
    await expect(runPipeline(job, recorder())).rejects.toMatchObject({ code: 'E-CONV-01' });
    expect(quantize).not.toHaveBeenCalled();
  });
});

describe('runPipeline benchmarking (WP-14)', () => {
  it('saves speed and RAM metrics on every file that passed the smoke test', async () => {
    const result = await runPipeline(job, recorder());
    expect(benchmarkFile).toHaveBeenCalledTimes(3); // F16 + Q5_K_M + Q4_K_M
    for (const v of result.variants) expect(v.metrics).toMatchObject(METRICS);
  });

  it('does not benchmark a file that failed the smoke test', async () => {
    smokeTest.mockImplementation(async (file) =>
      file.endsWith('Q5_K_M.gguf') ? { passed: false, output: '' } : { passed: true, output: 'ok' }
    );
    const result = await runPipeline(job, recorder());
    expect(benchmarkFile).toHaveBeenCalledTimes(2);
    expect(result.variants.find((v) => v.level === 'Q5_K_M').metrics).toBeUndefined();
  });

  it('keeps the job going when one benchmark fails (that file just has no numbers)', async () => {
    benchmarkFile.mockImplementation(async (file) => {
      if (file.endsWith('F16.gguf'))
        throw Object.assign(new Error('crashed'), { code: 'E-BENCH-01' });
      return METRICS;
    });
    const report = recorder();
    const result = await runPipeline(job, report);
    expect(result.variants.find((v) => v.level === 'F16').metrics.tpsGen).toBeUndefined();
    expect(result.variants.find((v) => v.level === 'Q4_K_M').metrics).toMatchObject(METRICS);
    expect(report.logs).toContainEqual({
      message: 'F16: benchmark failed (E-BENCH-01): crashed',
      level: 'warn',
    });
  });

  it('marks an unstable file with a warning in the log', async () => {
    benchmarkFile.mockResolvedValue({ ...METRICS, unstable: true });
    const report = recorder();
    await runPipeline(job, report);
    expect(report.logs.some((l) => l.level === 'warn' && l.message.includes('UNSTABLE'))).toBe(
      true
    );
  });
});

describe('runPipeline quality + F16 clean-up (WP-16)', () => {
  const f16File = () => path.join(tmp, 'artifacts', 'test-job', 'SmolLM2-135M-Instruct-F16.gguf');

  it('adds perplexity and task accuracy next to the speed numbers', async () => {
    const result = await runPipeline(job, recorder());
    expect(measureQuality).toHaveBeenCalledTimes(3);
    const q4 = result.variants.find((v) => v.level === 'Q4_K_M');
    expect(q4.metrics).toMatchObject({ ...METRICS, perplexity: 19.87, taskAccuracy: 41.5 });
    expect(q4.metrics.settings.quality).toEqual({ chunks: 100, tasks: 400 });
  });

  it('deletes the F16 file at the end but keeps its numbers as the baseline', async () => {
    const result = await runPipeline(job, recorder());
    const f16 = result.variants.find((v) => v.level === 'F16');
    expect(fs.existsSync(f16File())).toBe(false);
    expect(f16.fileDeleted).toBe(true);
    expect(f16.metrics.perplexity).toBe(19.87);
    const q4 = result.variants.find((v) => v.level === 'Q4_K_M');
    expect(fs.existsSync(q4.filePath)).toBe(true);
    expect(q4.fileDeleted).toBeUndefined();
  });

  it('still finishes (without quality numbers) when the test files are missing', async () => {
    checkDatasets.mockRejectedValue(
      Object.assign(new Error('WikiText-2 (test) is missing.'), {
        code: 'E-DATA-01',
        hint: 'Run npm run fetch:datasets',
      })
    );
    const report = recorder();
    const result = await runPipeline(job, report);
    expect(measureQuality).not.toHaveBeenCalled();
    expect(report.stages.some((s) => s.startsWith('EVALUATING'))).toBe(false);
    expect(report.logs.some((l) => l.level === 'error' && l.message.startsWith('E-DATA-01'))).toBe(
      true
    );
    expect(result.variants.find((v) => v.level === 'F16').fileDeleted).toBe(true);
  });

  it('keeps going when one quality test fails (that file just has no quality numbers)', async () => {
    measureQuality.mockImplementation(async (file) => {
      if (file.endsWith('Q5_K_M.gguf')) {
        throw Object.assign(new Error('HellaSwag failed.'), { code: 'E-EVAL-01' });
      }
      return QUALITY;
    });
    const report = recorder();
    const result = await runPipeline(job, report);
    expect(result.variants.find((v) => v.level === 'Q5_K_M').metrics.perplexity).toBeUndefined();
    expect(result.variants.find((v) => v.level === 'Q4_K_M').metrics.perplexity).toBe(19.87);
    expect(report.logs).toContainEqual({
      message: 'Q5_K_M: quality test failed (E-EVAL-01): HellaSwag failed.',
      level: 'warn',
    });
  });

  it('a cancel during evaluation still stops the job and removes its files', async () => {
    const report = recorder();
    report.stage = async (status) => {
      if (status === 'EVALUATING') throw Object.assign(new Error('Cancelled'), { cancelled: true });
    };
    await expect(runPipeline(job, report)).rejects.toMatchObject({ cancelled: true });
    expect(fs.existsSync(path.join(tmp, 'artifacts', 'test-job'))).toBe(false);
  });
});

describe('runPipeline hardening (WP-13)', () => {
  const outDir = () => path.join(tmp, 'artifacts', 'test-job');

  it('deletes the job folder when a stage fails half-way (no junk left)', async () => {
    convertToF16.mockImplementation(async (dir, out) => {
      fs.writeFileSync(out, 'half-written F16'); // the tool wrote part of the file, then died
      throw Object.assign(new Error('timed out'), { code: 'E-TIME-01' });
    });
    const report = recorder();
    await expect(runPipeline(job, report)).rejects.toMatchObject({ code: 'E-TIME-01' });
    expect(fs.existsSync(outDir())).toBe(false);
    expect(report.logs.at(-1)).toMatchObject({ level: 'warn' });
  });

  it('deletes the finished files too when no level passes (E-VAL-01)', async () => {
    smokeTest.mockResolvedValue({ passed: false, output: '' });
    await expect(runPipeline(job, recorder())).rejects.toMatchObject({ code: 'E-VAL-01' });
    expect(fs.existsSync(outDir())).toBe(false);
  });

  it('deletes the job folder when the job is cancelled between stages', async () => {
    const report = recorder();
    report.stage = async (status) => {
      if (status === 'QUANTIZING') throw Object.assign(new Error('Cancelled'), { cancelled: true });
    };
    await expect(runPipeline(job, report)).rejects.toMatchObject({ cancelled: true });
    expect(fs.existsSync(outDir())).toBe(false);
  });

  it('stops with E-DISK-01 before downloading when free disk is below the reserve', async () => {
    getFreeDiskMb.mockResolvedValue(settings.diskReserveMb - 1);
    await expect(runPipeline(job, recorder())).rejects.toMatchObject({ code: 'E-DISK-01' });
    expect(downloadModel).not.toHaveBeenCalled();
  });

  it('stops before quantizing when the disk fills up during the job', async () => {
    // plenty of space for download + convert, then the disk is nearly full
    getFreeDiskMb
      .mockResolvedValueOnce(50_000)
      .mockResolvedValueOnce(50_000)
      .mockResolvedValue(1_000);
    await expect(runPipeline(job, recorder())).rejects.toMatchObject({ code: 'E-DISK-01' });
    expect(quantize).not.toHaveBeenCalled();
    expect(fs.existsSync(outDir())).toBe(false);
  });

  it('deletes the downloaded snapshot after conversion for normal models', async () => {
    const snapshot = path.join(tmp, 'models', 'm');
    fs.mkdirSync(snapshot, { recursive: true });
    await runPipeline(job, recorder());
    expect(fs.existsSync(snapshot)).toBe(false);
  });

  it('keeps the downloaded snapshot of demo models (fast live demos)', async () => {
    const snapshot = path.join(tmp, 'models', 'm');
    fs.mkdirSync(snapshot, { recursive: true });
    await runPipeline({ ...job, model: { ...job.model, isDemo: true } }, recorder());
    expect(fs.existsSync(snapshot)).toBe(true);
  });
});
