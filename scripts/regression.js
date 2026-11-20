// regression.js — re-runs the REAL pipeline on the demo models and checks nothing got worse
// ("regressed") since the sizes were measured by hand (WP-02) and in the catalog trials (WP-09):
//   1. every level is made and passes the smoke test,
//   2. every file size is within 1 % of the size measured before,
//   3. a stopped job leaves no junk: one job gets a tiny time limit on purpose; afterwards its
//      folder must be gone.
// It writes the results to docs/regression-M2.md and exits with code 1 if anything failed.
// Run on the model machine (needs llama.cpp; demo models are reused if already downloaded):
//   npm run regression
// SRS: REQ-12 – REQ-15. Owner: Sibghatullah (WP-13).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { settings, ROOT_DIR } from '../backend/config/settings.js';
import { CATALOG_SEED } from '../backend/seedData.js';
import { jobDir, runPipeline } from '../backend/worker/pipeline.js';

const LEVELS = ['Q5_K_M', 'Q4_K_M'];
const SIZE_TOLERANCE = 0.01; // 1 %: the same inputs + the same llama.cpp give the same sizes

// File sizes in MiB measured before (docs/catalog-trials.md). Same model, revision and
// llama.cpp tag → the sizes must come out the same again.
const EXPECTED_MB = {
  'HuggingFaceTB/SmolLM2-135M-Instruct': { F16: 258.3, Q5_K_M: 106.9, Q4_K_M: 100.6 },
  'HuggingFaceTB/SmolLM2-360M-Instruct': { F16: 691.9, Q5_K_M: 276.5, Q4_K_M: 258.1 },
  'Qwen/Qwen2.5-0.5B-Instruct': { F16: 948.1, Q5_K_M: 400.6, Q4_K_M: 379.4 },
};

// Prints only the stages (not the hundreds of tool lines); keeps every line for the log file.
function quietReporter(lines) {
  return {
    async stage(status, text) {
      lines.push(`[${status}] ${text}`);
      console.log(`   ${status.padEnd(12)} ${text}`);
    },
    async log(message, level = 'info') {
      lines.push(`  ${level === 'info' ? ' ' : level === 'warn' ? '!' : '✖'} ${message}`);
    },
  };
}

async function checkModel(model) {
  const name = model.hfRepoId.split('/')[1];
  const job = { _id: `regression-${name}`, model, quantLevels: LEVELS };
  const lines = [];
  const started = Date.now();
  const row = { model: model.hfRepoId, problems: [], files: [] };
  console.log(`\n▶ ${model.hfRepoId}`);

  try {
    const result = await runPipeline(job, quietReporter(lines));
    for (const v of result.variants) {
      const expected = EXPECTED_MB[model.hfRepoId]?.[v.level];
      const diff = expected ? (v.fileSizeMb - expected) / expected : 0;
      row.files.push({ level: v.level, sizeMb: v.fileSizeMb, expected, smoke: v.smokePassed });
      if (!v.smokePassed) row.problems.push(`${v.level} failed the smoke test`);
      if (expected && Math.abs(diff) > SIZE_TOLERANCE) {
        row.problems.push(`${v.level} is ${v.fileSizeMb} MB, expected ${expected} MB`);
      }
    }
    for (const level of ['F16', ...LEVELS]) {
      if (!result.variants.some((v) => v.level === level)) row.problems.push(`${level} missing`);
    }
  } catch (err) {
    row.problems.push(`${err.code || 'ERROR'}: ${err.message}`);
  }

  row.seconds = Math.round((Date.now() - started) / 1000);
  // The regression files are only for checking — delete them so they don't fill the disk.
  fs.rmSync(jobDir(job._id), { recursive: true, force: true });
  writeLog(name, lines);
  console.log(
    `   ${row.problems.length ? `✖ ${row.problems.join('; ')}` : '✔ OK'} (${row.seconds} s)`
  );
  return row;
}

// A job that is stopped half-way (here: a 1-second time limit for the conversion) must fail
// with E-TIME-01 and leave no files behind.
async function checkStoppedJobLeavesNoJunk(model) {
  console.log(`\n▶ Stop test: ${model.hfRepoId} with a 1-second conversion limit`);
  const job = { _id: 'regression-stop-test', model, quantLevels: LEVELS };
  const lines = [];
  const saved = settings.timeoutsMin.convert;
  settings.timeoutsMin.convert = 1 / 60; // 1 second — far too short on purpose
  let code = 'none';
  try {
    await runPipeline(job, quietReporter(lines));
  } catch (err) {
    code = err.code;
  } finally {
    settings.timeoutsMin.convert = saved;
  }
  writeLog('stop-test', lines);
  const leftOver = fs.existsSync(jobDir(job._id));
  const problems = [];
  if (code !== 'E-TIME-01') problems.push(`expected E-TIME-01, got ${code}`);
  if (leftOver) problems.push(`files left in ${jobDir(job._id)}`);
  console.log(
    `   ${problems.length ? `✖ ${problems.join('; ')}` : '✔ stopped with E-TIME-01, no files left'}`
  );
  return { code, leftOver, problems };
}

function writeLog(name, lines) {
  const dir = path.join(settings.dataDir, 'regression');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.log`), lines.join('\n'));
}

function writeReport(rows, stop) {
  const date = new Date().toISOString().slice(0, 10);
  const passed = rows.every((r) => !r.problems.length) && !stop.problems.length;
  const fileCell = (r, level) => {
    const f = r.files.find((x) => x.level === level);
    if (!f) return '—';
    return `${f.sizeMb}${f.expected ? ` (exp. ${f.expected})` : ''} ${f.smoke ? '✔' : '✖'}`;
  };
  const md = [
    '# Regression check — M2',
    '',
    `Made by \`npm run regression\` (scripts/regression.js) on **${date}**. Result: **${passed ? 'PASS' : 'FAIL'}**.`,
    '',
    `Machine: ${os.cpus()[0]?.model.trim()} (${os.availableParallelism()} threads), ${Math.round(os.totalmem() / 2 ** 30)} GB RAM, ${os.type()} ${os.release()} · llama.cpp **${settings.llamaCppRef}** · levels ${LEVELS.join(', ')}`,
    '',
    'Sizes in MiB; "exp." = size measured before (docs/catalog-trials.md), allowed difference 1 %;',
    '✔ = smoke test passed. Time includes conversion, quantization and smoke tests (downloads reused).',
    '',
    '| Model | F16 | Q5_K_M | Q4_K_M | Time | Result |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.model} | ${fileCell(r, 'F16')} | ${fileCell(r, 'Q5_K_M')} | ${fileCell(r, 'Q4_K_M')} | ${r.seconds} s | ${r.problems.length ? `✖ ${r.problems.join('; ')}` : '✔ pass'} |`
    ),
    '',
    '## A stopped job leaves no junk',
    '',
    `SmolLM2-135M with a **1-second** conversion time limit: stopped with **${stop.code}**, files left behind: **${stop.leftOver ? 'yes ✖' : 'none ✔'}**.`,
    '',
    'Logs of each run: `data/regression/*.log` (not committed).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT_DIR, 'docs', 'regression-M2.md'), md);
  return passed;
}

// The regression compares sizes, smoke tests and clean-up — not speed or quality numbers — so
// it uses the short demo-mode tests (WP-16): a few minutes instead of ~30.
settings.demoMode = true;

const demoModels = CATALOG_SEED.filter((m) => m.isDemo);
console.log(
  `PocketPrune regression — llama.cpp ${settings.llamaCppRef}, ${demoModels.length} demo models`
);
const rows = [];
for (const model of demoModels) rows.push(await checkModel(model));
const stop = await checkStoppedJobLeavesNoJunk(demoModels[0]);

const passed = writeReport(rows, stop);
console.log(
  `\n${passed ? '✔ Regression PASSED' : '✖ Regression FAILED'} — report: docs/regression-M2.md`
);
process.exitCode = passed ? 0 : 1;
