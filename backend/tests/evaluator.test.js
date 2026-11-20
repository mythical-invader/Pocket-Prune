// evaluator.test.js — turning llama-bench JSON into metrics: averages, spread, the "unstable"
// flag, saved settings, and peak RAM. The example data is a REAL llama-bench b12376 run of
// SmolLM2-135M Q4_K_M on the model machine (15 Nov 2026). llama.cpp and the RAM watcher are
// mocked. Quality (WP-16): the dataset checks use small temporary files; the quality numbers
// come from mocked perplexity / HellaSwag results measured on the same model.
// Owner: Sibghatullah (WP-14, WP-16).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import { benchmark, hellaswag, perplexity } from '../worker/llamacpp.js';
import { watchPeakMemory } from '../utils/peakMemory.js';
import {
  DATASETS,
  addQuality,
  benchmarkFile,
  checkDatasets,
  measureQuality,
  qualitySizes,
  spread,
  summarise,
} from '../worker/evaluator.js';

vi.mock('../worker/llamacpp.js', () => ({
  benchmark: vi.fn(),
  perplexity: vi.fn(),
  hellaswag: vi.fn(),
}));
vi.mock('../utils/peakMemory.js', () => ({ watchPeakMemory: vi.fn() }));

const common = {
  build_number: 12376,
  cpu_info: 'Intel(R) Core(TM) i7-14700HX',
  n_threads: 20,
  n_gpu_layers: 0,
};
const REAL_TESTS = [
  { ...common, n_prompt: 512, n_gen: 0, avg_ts: 990.302608, stddev_ts: 4.848852, samples_ts: [986.18, 989.083, 995.645] },
  { ...common, n_prompt: 0, n_gen: 128, avg_ts: 200.264351, stddev_ts: 6.663148, samples_ts: [193.147, 201.292, 206.354] },
]; // prettier-ignore
const SIZES = { prompt: 512, gen: 128 };

describe('spread', () => {
  it('is (fastest − slowest) / average', () => {
    expect(spread([90, 100, 110])).toBeCloseTo(0.2);
    expect(spread([100, 100, 100])).toBe(0);
    expect(spread([])).toBe(0);
  });
});

describe('summarise', () => {
  it('turns the real llama-bench output into the saved metrics', () => {
    const m = summarise(REAL_TESTS, { peakRamMb: 170.5, sizes: SIZES });
    expect(m).toMatchObject({
      tpsPrompt: 990.3,
      tpsPromptStd: 4.8,
      tpsGen: 200.3,
      tpsGenStd: 6.7,
      peakRamMb: 170.5,
      runs: 3,
      unstable: false, // the runs differ by ~1 % and ~6.6 %
    });
    expect(m.settings).toMatchObject({
      tool: 'llama-bench',
      llamaCppBuild: 12376,
      threads: 20,
      promptTokens: 512,
      genTokens: 128,
      gpuLayers: 0,
      spreadGenPct: 6.6,
    });
  });

  it('marks a file unstable when its runs differ by more than 10 %', () => {
    const shaky = [REAL_TESTS[0], { ...REAL_TESTS[1], samples_ts: [150, 200, 210] }];
    expect(summarise(shaky, { peakRamMb: 170, sizes: SIZES }).unstable).toBe(true);
  });

  it('leaves peak RAM empty when it could not be measured', () => {
    expect(summarise(REAL_TESTS, { peakRamMb: null, sizes: SIZES }).peakRamMb).toBeUndefined();
  });

  it('refuses output without both tests', () => {
    expect(() => summarise([REAL_TESTS[0]], { sizes: SIZES })).toThrow(/missing/);
  });
});

describe('benchmarkFile', () => {
  it('runs llama-bench 3 times and watches the RAM of that process', async () => {
    const stop = vi.fn(async () => 170.5);
    watchPeakMemory.mockReturnValue({ stop });
    benchmark.mockImplementation(async (file, { onSpawn, runs }) => {
      onSpawn({ pid: 4242 }); // llama-bench has started
      expect(runs).toBe(3);
      return { tests: REAL_TESTS, sizes: SIZES };
    });

    const m = await benchmarkFile('x-Q4_K_M.gguf');
    expect(watchPeakMemory).toHaveBeenCalledWith(4242);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(m.peakRamMb).toBe(170.5);
    expect(m.settings.demoMode).toBe(settings.demoMode);
  });

  it('stops watching the RAM when the benchmark fails', async () => {
    const stop = vi.fn(async () => null);
    watchPeakMemory.mockReturnValue({ stop });
    benchmark.mockImplementation(async (file, { onSpawn }) => {
      onSpawn({ pid: 1 });
      throw Object.assign(new Error('crashed'), { code: 'E-BENCH-01' });
    });

    await expect(benchmarkFile('x.gguf')).rejects.toMatchObject({ code: 'E-BENCH-01' });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('quality (WP-16)', () => {
  afterEach(() => {
    settings.demoMode = false;
  });

  it('uses 100 chunks / 400 tasks, and 10 / 100 in demo mode', () => {
    expect(qualitySizes()).toEqual({ chunks: 100, tasks: 400 });
    settings.demoMode = true;
    expect(qualitySizes()).toEqual({ chunks: 10, tasks: 100 });
  });

  it('measureQuality: perplexity + HellaSwag with their ranges and the exact datasets used', async () => {
    // Real numbers: SmolLM2-135M F16 on b12376 (15/20 Nov 2026).
    perplexity.mockResolvedValue({ value: 18.9165, plusMinus: 0.3499 });
    hellaswag.mockResolvedValue({ tasks: 400, accuracy: 42.0, low: 37.2618, high: 46.8904 });

    const q = await measureQuality('x-F16.gguf', { wikitext: 'w.raw', hellaswag: 'h.txt' });
    expect(perplexity).toHaveBeenCalledWith(
      'x-F16.gguf',
      'w.raw',
      expect.objectContaining({ chunks: 100 })
    );
    expect(hellaswag).toHaveBeenCalledWith(
      'x-F16.gguf',
      'h.txt',
      expect.objectContaining({ tasks: 400 })
    );
    expect(q).toMatchObject({
      perplexity: 18.92,
      perplexityStd: 0.35,
      taskAccuracy: 42,
      taskAccuracyMargin: 4.8, // half of 37.3 … 46.9
      taskName: 'HellaSwag',
    });
    expect(q.settings).toMatchObject({
      context: 512,
      chunks: 100,
      tasks: 400,
      datasetSha256: DATASETS.wikitext.sha256,
      taskDatasetSha256: DATASETS.hellaswag.sha256,
    });
  });

  it('addQuality keeps the speed numbers and their settings', () => {
    const speed = { tpsGen: 200, settings: { threads: 20 } };
    const merged = addQuality(speed, { perplexity: 19.87, settings: { chunks: 100 } });
    expect(merged).toEqual({
      tpsGen: 200,
      perplexity: 19.87,
      settings: { threads: 20, quality: { chunks: 100 } },
    });
    expect(addQuality(undefined, { perplexity: 1, settings: {} }).perplexity).toBe(1); // no speed numbers
  });

  describe('checkDatasets', () => {
    const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-data-'));
    const saved = {};
    const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

    beforeEach(() => {
      settings.dataDir = tmpData;
      for (const [key, d] of Object.entries(DATASETS)) {
        saved[key] = d.sha256;
        fs.mkdirSync(path.dirname(path.join(tmpData, d.file)), { recursive: true });
        fs.writeFileSync(path.join(tmpData, d.file), `test ${key}`);
        d.sha256 = sha(`test ${key}`); // pretend these small files are the real ones
      }
    });
    afterEach(() => {
      for (const [key, d] of Object.entries(DATASETS)) d.sha256 = saved[key];
    });
    afterAll(() => fs.rmSync(tmpData, { recursive: true, force: true }));

    it('returns the full paths when both files are present and unchanged', async () => {
      const paths = await checkDatasets();
      expect(paths.wikitext).toBe(path.join(tmpData, DATASETS.wikitext.file));
      expect(paths.hellaswag).toBe(path.join(tmpData, DATASETS.hellaswag.file));
    });

    it('refuses a missing file (E-DATA-01) and tells how to fix it', async () => {
      fs.rmSync(path.join(tmpData, DATASETS.hellaswag.file));
      await expect(checkDatasets()).rejects.toMatchObject({
        code: 'E-DATA-01',
        message: expect.stringContaining('missing'),
        hint: expect.stringContaining('fetch:datasets'),
      });
    });

    it('refuses a changed file, because results would not be comparable', async () => {
      fs.writeFileSync(path.join(tmpData, DATASETS.wikitext.file), 'one byte different!');
      await expect(checkDatasets()).rejects.toMatchObject({
        code: 'E-DATA-01',
        message: expect.stringContaining('changed'),
      });
    });
  });
});
