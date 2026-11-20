// artifactController.js — the compressed GGUF files ("artifacts") of the user's finished jobs:
// a list for the Downloads page, and the download itself.
// Files live on the disk of the machine that ran the job (data/artifacts/<jobId>/), never in
// MongoDB. res.download() streams the file in pieces, so even a 2 GB file uses little memory and
// the browser can resume an interrupted download.
// SRS: REQ-30, REQ-32. Owner: Huzaifah (WP-17).
import path from 'node:path';
import Job from '../models/Job.js';
import { appError } from '../utils/errors.js';
import { onThisServer } from '../utils/artifactFiles.js';

// GET /api/artifacts — every file of the user's completed jobs, newest job first.
export async function listArtifacts(req, res, next) {
  try {
    const jobs = await Job.find({ user: req.user._id, status: 'COMPLETED' })
      .sort({ finishedAt: -1 })
      .limit(50)
      .select('model variants finishedAt fake demoMode')
      .populate('model', 'displayName hfRepoId license');

    const files = [];
    for (const job of jobs) {
      for (const v of job.variants) {
        if (!v.smokePassed) continue; // a file that failed its test is not offered at all
        files.push({
          jobId: job._id,
          model: job.model?.displayName ?? 'Unknown model',
          license: job.model?.license ?? null,
          level: v.level,
          fileSizeMb: v.fileSizeMb,
          sha256: v.sha256,
          expiresAt: v.expiresAt ?? null, // set by the storage clean-up (WP-24)
          fileDeleted: Boolean(v.fileDeleted), // e.g. F16 after evaluation (WP-16)
          onThisServer: !v.fileDeleted && onThisServer(v.filePath),
          finishedAt: job.finishedAt,
          fake: Boolean(job.fake),
        });
      }
    }
    res.json(files);
  } catch (err) {
    next(err);
  }
}

// GET /api/artifacts/:jobId/:level/download — sends one GGUF file.
export async function downloadArtifact(req, res, next) {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      user: req.user._id,
      status: 'COMPLETED',
    });
    const variant = job?.variants.find((v) => v.level === req.params.level);
    if (!variant || !variant.smokePassed) {
      throw appError('E-NOTFOUND-01', { message: 'This file does not exist.' });
    }
    if (variant.fileDeleted) {
      throw appError('E-NOTFOUND-01', {
        message: `The ${variant.level} file was deleted after evaluation; only its measurements are kept.`,
        hint: 'Download one of the compressed levels instead.',
      });
    }
    if (!onThisServer(variant.filePath)) {
      throw appError('E-NOTFOUND-01', {
        message: 'This file is not on this server.',
        hint: 'Files stay on the machine that ran the job (the model machine): download it there.',
      });
    }

    // A clear name for the saved file, e.g. "SmolLM2-135M-Instruct-Q4_K_M.gguf".
    res.download(variant.filePath, path.basename(variant.filePath), (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err.name === 'CastError' ? appError('E-NOTFOUND-01') : err);
  }
}
