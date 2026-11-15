// pipeline.js — the real compression pipeline for ONE job, stage by stage:
//   DOWNLOADING → CONVERTING (F16) → QUANTIZING (each level) → VALIDATING (smoke test)
// Benchmarking, perplexity and the recommendation are added in WP-14 / WP-16 / WP-18.
// It returns the variants; the caller (cli.js now, worker.js in WP-11) saves them.
// fakePipeline.js exports the same runPipeline(job, report), so the worker can use either.
// SRS: REQ-11 – REQ-14, REQ-16. Owner: Sibghatullah (WP-06).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { appError } from '../utils/errors.js';
import { fileSizeMb, sha256File } from '../utils/fileHash.js';
import { downloadModel } from './downloader.js';
import { checkInstalled, convertToF16, quantize, smokeTest } from './llamacpp.js';
import { consoleReporter } from './reporter.js';

// job = { _id, model: { hfRepoId, revision }, quantLevels: ['Q5_K_M', 'Q4_K_M'] }
export async function runPipeline(job, report = consoleReporter()) {
  // Tool output can be hundreds of lines; save each one without waiting for the database.
  const onLine = (line) => report.log(line).catch(() => {});
  const { hfRepoId, revision } = job.model;
  const name = hfRepoId.split('/')[1]; // "SmolLM2-135M-Instruct"
  const outDir = path.join(settings.dataDir, 'artifacts', String(job._id));
  fs.mkdirSync(outDir, { recursive: true });
  const fileFor = (level) => path.join(outDir, `${name}-${level}.gguf`);
  const variants = [];

  checkInstalled(); // stop early with E-TOOL-01 if the pinned llama.cpp is missing

  // 1. Download (safetensors only, pinned revision; reused if already on disk)
  await report.stage('DOWNLOADING', `Downloading ${hfRepoId} @ ${revision.slice(0, 8)}`);
  const download = await downloadModel(hfRepoId, revision, { onLine });
  await report.log(
    download.reused
      ? 'Already downloaded — reusing it.'
      : `Downloaded in ${download.durationSec.toFixed(0)} s.`
  );

  // 2. Convert to the F16 baseline (if this fails nothing else can run → error stops the job)
  await report.stage('CONVERTING', 'Converting to an F16 GGUF file');
  const f16 = await convertToF16(download.dir, fileFor('F16'), { onLine, modelName: name });
  variants.push(await describeFile('F16', fileFor('F16'), f16.durationSec));
  await report.log(`F16 file: ${variants[0].fileSizeMb} MB`);

  // 3. Quantize each level — one failure doesn't stop the others (CLAUDE.md §7.2)
  for (const level of job.quantLevels) {
    await report.stage('QUANTIZING', `Quantizing to ${level}`);
    try {
      const q = await quantize(fileFor('F16'), fileFor(level), level, { onLine });
      const variant = await describeFile(level, fileFor(level), q.durationSec);
      variants.push(variant);
      await report.log(`${level} file: ${variant.fileSizeMb} MB`);
    } catch (err) {
      fs.rmSync(fileFor(level), { force: true }); // never keep a half-written file
      await report.log(`${level} failed (${err.code}): ${err.message}`, 'error');
    }
  }

  // 4. Smoke test every file: fixed prompt, 32 tokens, must finish in time with real text
  for (const variant of variants) {
    await report.stage('VALIDATING', `Smoke-testing ${variant.level}`);
    const smoke = await smokeTest(variant.filePath, { onLine });
    variant.smokePassed = smoke.passed;
    variant.smokeOutput = smoke.output.slice(0, 500);
    await report.log(
      `${variant.level}: ${smoke.passed ? 'PASS' : 'FAIL'} — "${variant.smokeOutput.slice(0, 80)}"`,
      smoke.passed ? 'info' : 'warn'
    );
  }

  const goodLevels = variants.filter((v) => v.level !== 'F16' && v.smokePassed);
  if (goodLevels.length === 0) throw appError('E-VAL-01');

  return { variants, llamaCppRef: settings.llamaCppRef };
}

// Size, SHA-256 and time of one finished file (REQ-14).
async function describeFile(level, filePath, durationSec) {
  return {
    level,
    filePath,
    fileSizeMb: fileSizeMb(filePath),
    sha256: await sha256File(filePath),
    durationSec: Math.round(durationSec * 10) / 10,
  };
}
