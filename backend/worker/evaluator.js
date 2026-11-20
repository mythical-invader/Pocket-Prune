// evaluator.js — measures each finished file on THIS machine.
// Speed (WP-14):
//   - prompt speed (tok/s): how fast the model reads the input        (llama-bench "pp" test)
//   - generation speed (tok/s): how fast it writes the answer         (llama-bench "tg" test)
//   - peak RAM (MB): the most memory the program used                 (utils/peakMemory.js)
//   - unstable: the slowest and fastest of the 3 runs differ by more than 10 %
// Quality (WP-16):
//   - perplexity on WikiText-2 (lower = better), with its ± range
//   - task accuracy on HellaSwag (% correct, 25 % = guessing), with its 95 % range (evaluation E2)
//   Both use FIXED local files whose SHA-256 is checked first, so every file and every machine
//   is measured on exactly the same text.
// Every result also stores the settings it was measured with (REQ-21).
// SRS: REQ-17, REQ-18, REQ-21. Owner: Sibghatullah (WP-14, WP-16).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { appError } from '../utils/errors.js';
import { sha256File } from '../utils/fileHash.js';
import { watchPeakMemory } from '../utils/peakMemory.js';
import { benchmark, hellaswag, perplexity } from './llamacpp.js';

// The fixed test files (inside DATA_DIR). Download them with `npm run fetch:datasets`.
// If a SHA-256 changes, results are no longer comparable — so we refuse to measure (E-DATA-01).
export const DATASETS = {
  wikitext: {
    name: 'WikiText-2 (test)',
    file: path.join('wikitext', 'wiki.test.raw'),
    sha256: '173c87a53759e0201f33e0ccf978e510c2042d7f2cb78229d9a50d79b9e7dd08',
  },
  hellaswag: {
    name: 'HellaSwag (validation)',
    file: path.join('hellaswag', 'hellaswag_val_full.txt'),
    sha256: 'd572539320eb2050e858ca34b495bbe2103e3b3f1391a9c3bcdf215b0bb93bd1',
  },
};

// How much of each test we run. Demo mode is shorter, so live demos stay quick (CLAUDE.md §7.4).
export function qualitySizes() {
  return settings.demoMode ? { chunks: 10, tasks: 100 } : { chunks: 100, tasks: 400 };
}

export const RUNS = 3; // each test is repeated 3 times and averaged (CLAUDE.md §7.2)
export const UNSTABLE_LIMIT = 0.1; // > 10 % difference between runs → "unstable"

const round1 = (n) => Math.round(n * 10) / 10;

// How far apart the runs are: (fastest − slowest) / average. 0.05 = the runs differ by 5 %.
export function spread(samples) {
  if (!samples?.length) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return mean ? (Math.max(...samples) - Math.min(...samples)) / mean : 0;
}

// llama-bench JSON (+ peak RAM) → the metrics object saved on the variant (Job.js metricsSchema).
export function summarise(tests, { peakRamMb, sizes }) {
  const pp = tests.find((t) => t.n_prompt > 0 && t.n_gen === 0); // prompt-reading test
  const tg = tests.find((t) => t.n_gen > 0 && t.n_prompt === 0); // writing test
  if (!pp || !tg) throw new Error('llama-bench output is missing the prompt or generation test.');

  const ppSpread = spread(pp.samples_ts);
  const tgSpread = spread(tg.samples_ts);
  return {
    tpsPrompt: round1(pp.avg_ts),
    tpsPromptStd: round1(pp.stddev_ts),
    tpsGen: round1(tg.avg_ts),
    tpsGenStd: round1(tg.stddev_ts),
    peakRamMb: peakRamMb ?? undefined,
    runs: tg.samples_ts.length,
    unstable: ppSpread > UNSTABLE_LIMIT || tgSpread > UNSTABLE_LIMIT,
    settings: {
      tool: 'llama-bench',
      llamaCppBuild: pp.build_number,
      cpu: pp.cpu_info,
      threads: pp.n_threads,
      promptTokens: sizes.prompt,
      genTokens: sizes.gen,
      gpuLayers: pp.n_gpu_layers,
      spreadPromptPct: round1(ppSpread * 100),
      spreadGenPct: round1(tgSpread * 100),
      ramMethod: 'operating-system peak counter of the llama-bench process',
      demoMode: settings.demoMode,
    },
  };
}

// Benchmark one GGUF file: speed (3 runs) + peak RAM while it runs.
export async function benchmarkFile(file, { onLine } = {}) {
  let watcher = null;
  try {
    const result = await benchmark(file, {
      onLine,
      runs: RUNS,
      onSpawn: (child) => {
        watcher = watchPeakMemory(child.pid);
      },
    });
    const peakRamMb = watcher ? await watcher.stop() : null;
    watcher = null;
    return summarise(result.tests, { peakRamMb, sizes: result.sizes });
  } finally {
    if (watcher) await watcher.stop(); // the benchmark failed: still stop watching
  }
}

// Check both test files exist and are byte-for-byte the expected ones. Returns their full paths.
// Done once per job (hashing ~9 MB takes a moment), before the quality tests start.
export async function checkDatasets() {
  const paths = {};
  for (const [key, dataset] of Object.entries(DATASETS)) {
    const full = path.join(settings.dataDir, dataset.file);
    if (!fs.existsSync(full)) {
      throw appError('E-DATA-01', { message: `${dataset.name} is missing (${dataset.file}).` });
    }
    if ((await sha256File(full)) !== dataset.sha256) {
      throw appError('E-DATA-01', {
        message: `${dataset.name} has changed (SHA-256 differs), so results would not be comparable.`,
      });
    }
    paths[key] = full;
  }
  return paths;
}

// Measure the quality of one GGUF file: perplexity + HellaSwag accuracy (+ their ranges).
export async function measureQuality(file, datasets, { onLine } = {}) {
  const sizes = qualitySizes();
  const ppl = await perplexity(file, datasets.wikitext, { chunks: sizes.chunks, onLine });
  const task = await hellaswag(file, datasets.hellaswag, { tasks: sizes.tasks, onLine });
  return {
    perplexity: Math.round(ppl.value * 100) / 100,
    perplexityStd: Math.round(ppl.plusMinus * 100) / 100,
    taskAccuracy: round1(task.accuracy),
    taskAccuracyMargin: round1((task.high - task.low) / 2), // ± half of the 95 % range
    taskName: 'HellaSwag',
    settings: {
      dataset: DATASETS.wikitext.name,
      datasetSha256: DATASETS.wikitext.sha256,
      context: 512,
      chunks: sizes.chunks,
      taskDataset: DATASETS.hellaswag.name,
      taskDatasetSha256: DATASETS.hellaswag.sha256,
      tasks: task.tasks,
      taskRange95: [task.low, task.high],
    },
  };
}

// Put the quality numbers into a file's metrics, next to the speed numbers from WP-14 (if any).
export function addQuality(metrics = {}, quality) {
  const { settings: qualitySettings, ...numbers } = quality;
  return {
    ...metrics,
    ...numbers,
    settings: { ...(metrics.settings || {}), quality: qualitySettings },
  };
}
