// pipeline.js — the real compression pipeline for ONE job, stage by stage:
//   DOWNLOADING → CONVERTING (F16) → QUANTIZING (each level) → VALIDATING (smoke test)
//   → BENCHMARKING (speed + peak RAM, WP-14)
// Perplexity and the recommendation are added in WP-16 / WP-18.
// It returns the variants; the caller (cli.js or worker.js) saves them.
// fakePipeline.js exports the same runPipeline(job, report), so the worker can use either.
// Hardening (WP-13):
//   - before each heavy step, free disk must stay above the reserve (2 GB) → else E-DISK-01;
//   - if ANYTHING fails, times out or is cancelled, the job's unfinished files are deleted;
//   - after conversion the downloaded snapshot is deleted (demo models are kept for fast demos).
// SRS: REQ-11 – REQ-16. Owner: Sibghatullah (WP-06, hardening WP-13).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { appError } from '../utils/errors.js';
import { fileSizeMb, sha256File } from '../utils/fileHash.js';
import { getFreeDiskMb } from '../utils/systemInfo.js';
import { downloadModel } from './downloader.js';
import { checkInstalled, convertToF16, quantize, smokeTest } from './llamacpp.js';
import { benchmarkFile } from './evaluator.js';
import { consoleReporter } from './reporter.js';

// The folder for one job's files: data/artifacts/<jobId>/
export function jobDir(jobId) {
  return path.join(settings.dataDir, 'artifacts', String(jobId));
}

// job = { _id, model: { hfRepoId, revision, isDemo }, quantLevels: ['Q5_K_M', 'Q4_K_M'] }
export async function runPipeline(job, report = consoleReporter()) {
  try {
    return await runStages(job, report);
  } catch (err) {
    // Failed, timed out or cancelled: a stopped job leaves no junk behind.
    fs.rmSync(jobDir(job._id), { recursive: true, force: true });
    await report.log('Removed the unfinished files of this job.', 'warn').catch(() => {});
    throw err;
  }
}

async function runStages(job, report) {
  // Tool output can be hundreds of lines; save each one without waiting for the database.
  const onLine = (line) => report.log(line).catch(() => {});
  const { hfRepoId, revision } = job.model;
  const name = hfRepoId.split('/')[1]; // "SmolLM2-135M-Instruct"
  const outDir = jobDir(job._id);
  fs.mkdirSync(outDir, { recursive: true });
  const fileFor = (level) => path.join(outDir, `${name}-${level}.gguf`);
  const variants = [];

  checkInstalled(); // stop early with E-TOOL-01 if the pinned llama.cpp is missing

  // 1. Download (safetensors only, pinned revision; reused if already on disk)
  await ensureDiskReserve();
  await report.stage('DOWNLOADING', `Downloading ${hfRepoId} @ ${revision.slice(0, 8)}`);
  const download = await downloadModel(hfRepoId, revision, { onLine });
  await report.log(
    download.reused
      ? 'Already downloaded — reusing it.'
      : `Downloaded in ${download.durationSec.toFixed(0)} s.`
  );

  // 2. Convert to the F16 baseline (if this fails nothing else can run → error stops the job)
  await ensureDiskReserve();
  await report.stage('CONVERTING', 'Converting to an F16 GGUF file');
  const f16 = await convertToF16(download.dir, fileFor('F16'), { onLine, modelName: name });
  variants.push(await describeFile('F16', fileFor('F16'), f16.durationSec));
  await report.log(`F16 file: ${variants[0].fileSizeMb} MB`);

  // The F16 file now holds all the weights: delete the downloaded snapshot to save disk
  // (CLAUDE.md §7.2). Demo models are kept so live demos start without downloading (§7.4).
  if (!job.model.isDemo) {
    fs.rmSync(download.dir, { recursive: true, force: true });
    await report.log('Deleted the downloaded model files (the F16 file replaces them).');
  }

  // 3. Quantize each level — one failure doesn't stop the others (CLAUDE.md §7.2)
  for (const level of job.quantLevels) {
    await ensureDiskReserve();
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

  // 5. Benchmark every file that passed (F16 too: it is the baseline the results compare with).
  // One failed benchmark only means that file has no speed numbers — the job goes on.
  for (const variant of variants.filter((v) => v.smokePassed)) {
    await report.stage('BENCHMARKING', `Measuring speed and RAM of ${variant.level}`);
    try {
      variant.metrics = await benchmarkFile(variant.filePath, { onLine });
      const m = variant.metrics;
      await report.log(
        `${variant.level}: prompt ${m.tpsPrompt} tok/s, generation ${m.tpsGen} tok/s, ` +
          `peak RAM ${m.peakRamMb ?? '?'} MB${m.unstable ? ' (UNSTABLE: runs differ > 10 %)' : ''}`,
        m.unstable ? 'warn' : 'info'
      );
    } catch (err) {
      if (err.cancelled) throw err;
      await report.log(
        `${variant.level}: benchmark failed (${err.code || 'E-BENCH-01'}): ${err.message}`,
        'warn'
      );
    }
  }

  return { variants, llamaCppRef: settings.llamaCppRef };
}

// Stop the job (E-DISK-01) while there is still room, instead of letting the disk fill up and
// Windows, MongoDB or the tools fail in confusing ways. The reserve is DISK_RESERVE_MB (2 GB).
export async function ensureDiskReserve() {
  fs.mkdirSync(settings.dataDir, { recursive: true }); // measuring needs the folder to exist
  const freeMb = await getFreeDiskMb(settings.dataDir);
  if (freeMb < settings.diskReserveMb) {
    throw appError('E-DISK-01', {
      message: `Only ${freeMb} MB free on the data drive; ${settings.diskReserveMb} MB must stay free.`,
    });
  }
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
