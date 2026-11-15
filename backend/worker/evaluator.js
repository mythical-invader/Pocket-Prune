// evaluator.js — measures how well each finished file runs on THIS machine (WP-14):
//   - prompt speed (tok/s): how fast the model reads the input        (llama-bench "pp" test)
//   - generation speed (tok/s): how fast it writes the answer         (llama-bench "tg" test)
//   - peak RAM (MB): the most memory the program used                 (utils/peakMemory.js)
//   - unstable: the slowest and fastest of the 3 runs differ by more than 10 %
// Every result also stores the settings it was measured with (threads, test sizes, CPU,
// llama.cpp build), so a number can always be explained and repeated (REQ-21).
// Perplexity (quality) is added here in WP-16.
// SRS: REQ-17, REQ-21. Owner: Sibghatullah (WP-14).
import { settings } from '../config/settings.js';
import { watchPeakMemory } from '../utils/peakMemory.js';
import { benchmark } from './llamacpp.js';

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
