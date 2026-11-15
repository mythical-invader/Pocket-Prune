// pipeline.test.js — checks the order of stages, the saved variants and the failure rules of
// pipeline.js. The downloader and llama.cpp adapter are mocked (no internet, no llama.cpp);
// the mocks write tiny files so sizes and SHA-256 are real. Free disk is mocked too.
// Owner: Sibghatullah (WP-06; clean-up and disk reserve WP-13).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import { downloadModel } from '../worker/downloader.js';
import { convertToF16, quantize, smokeTest } from '../worker/llamacpp.js';
import { runPipeline } from '../worker/pipeline.js';
import { getFreeDiskMb } from '../utils/systemInfo.js';

vi.mock('../worker/downloader.js', () => ({ downloadModel: vi.fn() }));
vi.mock('../utils/systemInfo.js', () => ({ getFreeDiskMb: vi.fn() }));
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
