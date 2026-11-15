// cli.js — run the compression pipeline from the terminal, without the website or MongoDB.
// Usage (from the repo root):
//   npm run pipeline -- --model HuggingFaceTB/SmolLM2-135M-Instruct --levels Q5_K_M,Q4_K_M
//   npm run pipeline -- --fake            (fake pipeline: no llama.cpp needed)
// The model's pinned revision comes from the catalog seed list (seedData.js).
// SRS: REQ-16 (pipeline runnable from the command line). Owner: Sibghatullah (WP-06).
import { parseArgs } from 'node:util';
import { settings } from './config/settings.js';
import { appError } from './utils/errors.js';
import { CATALOG_SEED } from './seedData.js';
import { runPipeline as realPipeline } from './worker/pipeline.js';
import { runPipeline as fakePipeline } from './worker/fakePipeline.js';
import { consoleReporter } from './worker/reporter.js';

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'HuggingFaceTB/SmolLM2-135M-Instruct' },
    levels: { type: 'string', default: 'Q5_K_M,Q4_K_M' },
    fake: { type: 'boolean', default: settings.fakePipeline },
  },
});

async function main() {
  const model = CATALOG_SEED.find((m) => m.hfRepoId === values.model);
  if (!model) throw appError('E-CAT-01', { message: `${values.model} is not in the catalog.` });
  if (model.paramsBillion > settings.maxParamsBillion) {
    throw appError('E-CAT-01', { message: `${model.hfRepoId} is larger than 4 B parameters.` });
  }

  const job = {
    _id: `cli-${Date.now()}`, // files go to data/artifacts/cli-<time>/
    model,
    quantLevels: values.levels.split(',').map((level) => level.trim()),
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
      'sha256 (start)': v.sha256.slice(0, 12),
      file: v.filePath,
    }))
  );
}

main().catch((err) => {
  console.error(`\n✖ ${err.code || 'ERROR'}: ${err.message}`);
  if (err.hint) console.error(`  How to fix: ${err.hint}`);
  process.exit(1);
});
