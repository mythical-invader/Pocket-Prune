// cli.js — run the compression pipeline from the terminal, without the website or MongoDB.
// Usage (from the repo root):
//   npm run pipeline -- --model HuggingFaceTB/SmolLM2-135M-Instruct --levels Q5_K_M,Q4_K_M
//   npm run pipeline -- --fake            (fake pipeline: no llama.cpp needed)
//   npm run pipeline -- --preference speed --ram 4096 --disk 8000   (recommend for another device)
// The model's pinned revision comes from the catalog seed list (seedData.js). Without --ram /
// --disk the recommendation is for THIS computer.
// SRS: REQ-16 (pipeline runnable from the command line), REQ-22. Owner: Sibghatullah (WP-06).
import fs from 'node:fs';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { settings } from './config/settings.js';
import { getHostProfile } from './utils/systemInfo.js';
import { appError } from './utils/errors.js';
import { CATALOG_SEED } from './seedData.js';
import { checkCatalogEntry } from './services/catalogService.js';
import { runPipeline as realPipeline } from './worker/pipeline.js';
import { runPipeline as fakePipeline } from './worker/fakePipeline.js';
import { consoleReporter } from './worker/reporter.js';

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'HuggingFaceTB/SmolLM2-135M-Instruct' },
    levels: { type: 'string', default: 'Q5_K_M,Q4_K_M' },
    fake: { type: 'boolean', default: settings.fakePipeline },
    preference: { type: 'string', default: 'balanced' }, // quality | speed | smallest | balanced
    ram: { type: 'string' }, // device RAM in MB (default: this computer)
    disk: { type: 'string' }, // device free disk in MB (default: this computer)
  },
});

// The device to recommend for: this computer, unless --ram / --disk describe another one.
async function deviceProfile() {
  fs.mkdirSync(settings.dataDir, { recursive: true }); // free disk is measured on this drive
  const host = await getHostProfile(settings.dataDir);
  const custom = values.ram || values.disk;
  return {
    name: custom ? 'CLI device' : `this computer (${os.hostname()})`,
    ramMb: Number(values.ram) || host.ramMb,
    freeDiskMb: Number(values.disk) || host.freeDiskMb,
    preference: values.preference,
  };
}

async function main() {
  const model = CATALOG_SEED.find((m) => m.hfRepoId === values.model);
  if (!model) throw appError('E-CAT-01', { message: `${values.model} is not in the catalog.` });
  // Same rules as seed.js (4 B limit, full commit hash…), so the CLI can't bypass them (REQ-3).
  const problems = checkCatalogEntry(model);
  if (problems.length) throw appError('E-CAT-01', { message: problems.join(' ') });

  const job = {
    _id: `cli-${Date.now()}`, // files go to data/artifacts/cli-<time>/
    model,
    quantLevels: values.levels.split(',').map((level) => level.trim()),
    profile: await deviceProfile(),
  };
  const runPipeline = values.fake ? fakePipeline : realPipeline;
  console.log(
    `PocketPrune CLI — ${values.fake ? 'FAKE pipeline' : `llama.cpp ${settings.llamaCppRef}`}`
  );

  const started = Date.now();
  const result = await runPipeline(job, consoleReporter());

  console.log(
    `\nDone in ${((Date.now() - started) / 1000).toFixed(0)} s${result.fake ? ' (FAKE DATA)' : ''}`
  );
  console.table(
    result.variants.map((v) => ({
      level: v.level,
      'size (MB)': v.fileSizeMb,
      smoke: v.smokePassed ? 'PASS' : 'FAIL',
      'prompt tok/s': v.metrics?.tpsPrompt ?? '—',
      'gen tok/s': v.metrics?.tpsGen ?? '—',
      'peak RAM (MB)': v.metrics?.peakRamMb ?? '—',
      stable: v.metrics ? (v.metrics.unstable ? 'NO' : 'yes') : '—',
      perplexity: v.metrics?.perplexity ?? '—',
      'HellaSwag %': v.metrics?.taskAccuracy ?? '—',
      'sha256 (start)': v.sha256.slice(0, 12),
      file: v.fileDeleted ? 'deleted (baseline)' : 'kept',
    }))
  );

  const rec = result.recommendation;
  if (rec) {
    console.log(`\nRecommendation: ${rec.chosenLevel ?? 'none'} (rule: ${rec.ruleFired})`);
    console.log(`  ${rec.explanation}`);
    if (rec.baselineSmallest) {
      console.log(`  Fits: smallest ${rec.baselineSmallest}, largest ${rec.baselineLargest}`);
    }
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.code || 'ERROR'}: ${err.message}`);
  if (err.hint) console.error(`  How to fix: ${err.hint}`);
  process.exit(1);
});
