// fakePipeline.js — ⏳ TEMPORARY (WP-06 → removed in WP-20, CLAUDE.md §7.7).
// Pretends to run a job so the website can be built and demoed on a laptop WITHOUT llama.cpp:
// it walks through the same stages (2–3 s each), writes normal log lines, and returns variants
// with REAL numbers measured by hand in WP-02 (SmolLM2-135M on the i7-14700HX), scaled to the
// model's size. It writes small placeholder files instead of real GGUFs.
// Every result carries fake: true, and the website shows a "FAKE DATA" badge for it.
// Used only when .env has FAKE_PIPELINE=true. Tests don't use it, so deleting it breaks nothing.
// Owner: Sibghatullah (WP-06).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { fileSizeMb, sha256File } from '../utils/fileHash.js';
import { consoleReporter } from './reporter.js';

// Measured in WP-02 (docs/LEARNING_NOTES.md §5); HellaSwag accuracy measured in WP-16 (400 tasks).
// Q8_0 was not measured — estimated values.
const MEASURED = {
  F16: {
    sizeMb: 258.3,
    tpsPrompt: 2188,
    tpsGen: 105,
    peakRamMb: 471,
    perplexity: 18.92,
    taskAccuracy: 42.0,
  },
  Q8_0: {
    sizeMb: 137.2,
    tpsPrompt: 1900,
    tpsGen: 160,
    peakRamMb: 350,
    perplexity: 18.95,
    taskAccuracy: 41.8,
  },
  Q5_K_M: {
    sizeMb: 106.9,
    tpsPrompt: 1589,
    tpsGen: 191,
    peakRamMb: 319,
    perplexity: 19.57,
    taskAccuracy: 40.5,
  },
  Q4_K_M: {
    sizeMb: 100.6,
    tpsPrompt: 974,
    tpsGen: 199,
    peakRamMb: 320,
    perplexity: 19.87,
    taskAccuracy: 40.8,
  },
};
const SMOKE_TEXT =
  'Paris. Paris is a city that is known for its historical landmarks, art museums…';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runPipeline(job, report = consoleReporter(), { delayMs = 2500 } = {}) {
  const name = job.model.hfRepoId.split('/')[1];
  // Bigger models → bigger files and more RAM (speed and perplexity are kept as measured).
  const scale = (job.model.f16SizeMb || MEASURED.F16.sizeMb) / MEASURED.F16.sizeMb;
  const outDir = path.join(settings.dataDir, 'artifacts', String(job._id));
  fs.mkdirSync(outDir, { recursive: true });

  const step = async (status, text) => {
    await report.stage(status, `${text} (FAKE)`);
    await wait(delayMs);
  };

  await step('DOWNLOADING', `Downloading ${job.model.hfRepoId}`);
  await step('CONVERTING', 'Converting to an F16 GGUF file');
  const levels = ['F16', ...job.quantLevels];
  for (const level of job.quantLevels) await step('QUANTIZING', `Quantizing to ${level}`);
  await step('VALIDATING', 'Smoke-testing every file');
  await step('BENCHMARKING', 'Measuring speed and peak RAM');
  await step('EVALUATING', 'Measuring perplexity on WikiText-2');
  await step('RECOMMENDING', 'Choosing the best file for the device');

  const variants = [];
  for (const level of levels) {
    const m = MEASURED[level];
    // A tiny text file stands in for the GGUF, so download links still have a file to send.
    const filePath = path.join(outDir, `${name}-${level}.FAKE.gguf`);
    fs.writeFileSync(filePath, `FAKE placeholder for ${name} ${level} — not a real model.\n`);
    variants.push({
      level,
      filePath,
      fileSizeMb: Math.round(m.sizeMb * scale * 10) / 10, // the size the real file would have
      sha256: await sha256File(filePath),
      smokePassed: true,
      smokeOutput: SMOKE_TEXT,
      durationSec: level === 'F16' ? 11 : 1,
      fileDeleted: level === 'F16', // like the real pipeline: F16 is deleted after evaluation
      metrics: {
        tpsPrompt: m.tpsPrompt,
        tpsGen: m.tpsGen,
        peakRamMb: Math.round(m.peakRamMb * scale),
        perplexity: m.perplexity,
        taskAccuracy: m.taskAccuracy,
        taskAccuracyMargin: 4.8,
        taskName: 'HellaSwag',
        runs: 3,
        unstable: false,
        settings: { fake: true, placeholderSizeMb: fileSizeMb(filePath) },
      },
    });
  }
  await report.log(`Made ${variants.length} FAKE files in ${outDir}`, 'warn');

  return {
    fake: true,
    variants,
    llamaCppRef: settings.llamaCppRef,
    demoMode: settings.demoMode,
    recommendation: {
      chosenLevel: job.quantLevels.includes('Q4_K_M') ? 'Q4_K_M' : job.quantLevels[0],
      baselineSmallest: job.quantLevels.includes('Q4_K_M') ? 'Q4_K_M' : job.quantLevels[0],
      baselineLargest: 'F16',
      ruleFired: 'FAKE',
      explanation:
        'FAKE DATA — made by the fake pipeline for building the website. Not a real result.',
      qualityRisk: false,
    },
  };
}
