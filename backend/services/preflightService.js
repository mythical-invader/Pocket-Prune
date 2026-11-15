// preflightService.js — the checks that run BEFORE a job, so a job that can't finish is stopped
// in one second instead of failing after ten minutes. Each check returns one row for the
// website's checklist: { id, label, passed, message, code?, hint? }.
// Disk and RAM are measured on THIS server, because this machine runs the compression.
// SRS: REQ-6, REQ-7, REQ-8, REQ-9, REQ-10. Owner: Huzaifah (WP-08).
import fs from 'node:fs';
import os from 'node:os';
import CatalogModel from '../models/CatalogModel.js';
import DeviceProfile from '../models/DeviceProfile.js';
import Job, { QUANT_LEVELS } from '../models/Job.js';
import { settings, ROOT_DIR } from '../config/settings.js';
import { getFreeDiskMb } from '../utils/systemInfo.js';
import { checkInstalled } from '../worker/llamacpp.js';
import { appError } from '../utils/errors.js';
import { estimateSizeMb } from '../utils/sizeEstimate.js';

const ACTIVE_STATUSES = ['QUEUED', 'DOWNLOADING', 'CONVERTING', 'QUANTIZING', 'VALIDATING',
  'BENCHMARKING', 'EVALUATING', 'RECOMMENDING']; // prettier-ignore

const gb = (mb) => `${(mb / 1024).toFixed(1)} GB`;

// A passed row, or a failed row built from an error code (message + hint come from errors.js).
const pass = (id, label, message) => ({ id, label, passed: true, message });
function fail(id, label, code, extra = {}) {
  const err = appError(code, extra);
  return { id, label, passed: false, code, message: err.message, hint: err.hint };
}

// ---------- the individual checks (each one is small on purpose) ----------

export function checkModel(model) {
  const label = 'Model is in the catalog';
  if (!model) return fail('model', label, 'E-CAT-01');
  return pass('model', label, `${model.displayName}, pinned to ${model.revision.slice(0, 7)}.`);
}

export function checkLevels(levels) {
  const label = 'Quantization levels are supported';
  const ok =
    Array.isArray(levels) && levels.length > 0 && levels.every((l) => QUANT_LEVELS.includes(l));
  if (!ok) return fail('levels', label, 'E-LVL-01');
  return pass('levels', label, levels.join(', '));
}

export function checkProfile(profile) {
  const label = 'Device profile chosen';
  if (!profile)
    return fail('profile', label, 'E-NOTFOUND-01', {
      message: 'Device profile not found.',
      hint: 'Choose or create a device on the Device step.',
    });
  return pass('profile', label, profile.name);
}

// REQ-7: free disk ≥ 3 × F16 + all quantized files + 2 GB reserve.
// 3 × F16 = the downloaded weights + the F16 GGUF + working room while converting.
export function estimateDiskNeedMb(f16SizeMb, levels) {
  const quantized = levels.reduce((sum, l) => sum + estimateSizeMb(f16SizeMb, l), 0);
  return Math.ceil(3 * f16SizeMb + quantized + settings.diskReserveMb);
}

export function checkDisk(needMb, freeMb) {
  const label = 'Enough free disk space';
  if (freeMb < needMb)
    return fail('disk', label, 'E-DISK-01', {
      message: `Needs ${gb(needMb)} free, only ${gb(freeMb)} free.`,
      hint: `Free ${gb(needMb - freeMb)} or choose fewer levels.`,
    });
  return pass('disk', label, `Needs ${gb(needMb)}, ${gb(freeMb)} free.`);
}

// REQ-8: free RAM ≥ 1.2 × F16 (the converter holds the whole model in memory).
export function checkRam(f16SizeMb, freeRamMb) {
  const label = 'Enough free memory (RAM)';
  const needMb = Math.ceil(1.2 * f16SizeMb);
  if (freeRamMb < needMb)
    return fail('ram', label, 'E-RAM-01', {
      message: `Needs ${gb(needMb)} free RAM, only ${gb(freeRamMb)} free.`,
    });
  return pass('ram', label, `Needs ${gb(needMb)}, ${gb(freeRamMb)} free.`);
}

export function checkLicence(model, accepted) {
  const label = 'Model licence accepted';
  if (!accepted) return fail('licence', label, 'E-LIC-01');
  return pass('licence', label, model ? model.license : 'Accepted');
}

export function checkToken(model) {
  const label = 'Hugging Face access';
  if (model?.gated && !settings.hfToken) return fail('token', label, 'E-HF-01');
  return pass('token', label, model?.gated ? 'Token set.' : 'Public model, no token needed.');
}

// REQ-9: the pinned llama.cpp must be installed. The fake pipeline doesn't use llama.cpp,
// so on a machine without it (the web machine) this check is skipped.
export function checkTool() {
  const label = `llama.cpp ${settings.llamaCppRef} installed`;
  if (settings.fakePipeline) return pass('tool', label, 'Skipped: FAKE_PIPELINE is on.');
  try {
    checkInstalled();
    return pass('tool', label, 'Found.');
  } catch (err) {
    return {
      id: 'tool',
      label,
      passed: false,
      code: err.code,
      message: err.message,
      hint: err.hint,
    };
  }
}

// REQ-10: at most MAX_ACTIVE_JOBS_PER_USER (2) jobs waiting or running.
export function checkActiveJobs(activeCount) {
  const label = 'Fewer than 2 jobs running';
  if (activeCount >= settings.maxActiveJobsPerUser) return fail('jobs', label, 'E-LIMIT-01');
  return pass('jobs', label, `${activeCount} running now.`);
}

// ---------- run them all ----------

// Looks up everything once, then runs every check (not just until the first failure),
// so the user sees the whole list at once.
export async function runPreflight({ user, modelId, levels, profileId, licenseAccepted }) {
  const [model, profile, activeCount] = await Promise.all([
    findOrNull(CatalogModel, { _id: modelId, isActive: true }),
    findOrNull(DeviceProfile, { _id: profileId, user: user._id }),
    Job.countDocuments({ user: user._id, status: { $in: ACTIVE_STATUSES } }),
  ]);

  const checks = [checkModel(model), checkLevels(levels), checkProfile(profile)];

  // Disk and RAM need the model's size, so they only run when the model and levels are known.
  if (model && checks[1].passed) {
    const folder = fs.existsSync(settings.dataDir) ? settings.dataDir : ROOT_DIR;
    const freeDiskMb = await getFreeDiskMb(folder);
    const freeRamMb = Math.round(os.freemem() / 1024 / 1024);
    checks.push(checkDisk(estimateDiskNeedMb(model.f16SizeMb, levels), freeDiskMb));
    checks.push(checkRam(model.f16SizeMb, freeRamMb));
  }

  checks.push(
    checkLicence(model, licenseAccepted),
    checkToken(model),
    checkTool(),
    checkActiveJobs(activeCount)
  );

  return { passed: checks.every((c) => c.passed), checks };
}

// findOne that treats a malformed id ("abc") the same as "not found".
async function findOrNull(Model, filter) {
  try {
    return await Model.findOne(filter);
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
}
