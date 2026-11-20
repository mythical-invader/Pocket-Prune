// resultController.js — the Results of a finished job: every file compared with F16, the
// recommendation for another device profile, and the export as CSV / JSON.
// Only the owner can see them, and only once the job has COMPLETED.
// SRS: REQ-17, REQ-20, REQ-22, REQ-28, REQ-30 – REQ-32. Owner: Huzaifah (WP-15, WP-17, WP-19).
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import DeviceProfile from '../models/DeviceProfile.js';
import { buildResults } from '../services/resultsService.js';
import { recommend, compareWithBaselines, RULES } from '../services/recommender.js';
import { toCsv, toJson, exportFileName } from '../services/exportService.js';
import { appError } from '../utils/errors.js';
import { onThisServer } from '../utils/artifactFiles.js';

// The user's own completed job, or a 404 that says why.
async function findCompletedJob(req) {
  const job = await Job.findOne({ _id: req.params.id, user: req.user._id })
    .populate('model', 'displayName hfRepoId revision f16SizeMb')
    .populate('profile', 'name preference');
  if (!job) throw appError('E-NOTFOUND-01', { message: 'Job not found.' });
  if (job.status !== 'COMPLETED') {
    throw appError('E-NOTFOUND-01', {
      message: 'No results yet: the job has not finished.',
      hint: 'Follow the job on its progress page; results appear when it completes.',
    });
  }
  return job;
}

// GET /api/jobs/:id/results
export async function getResults(req, res, next) {
  try {
    const job = await findCompletedJob(req);
    const results = buildResults(job);
    // Can THIS server send the file? (With the shared database it may be on the other laptop.)
    for (const row of results.rows) {
      const variant = job.variants.find((v) => v.level === row.level);
      row.onThisServer = row.downloadable && onThisServer(variant?.filePath);
    }
    res.json(results);
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs/:id/recommend  { profileId }
// Runs the recommender again on the SAME measurements for another of the user's devices.
// Nothing is saved: the job keeps the recommendation for the profile it was run with.
export async function recommendForProfile(req, res, next) {
  try {
    const job = await findCompletedJob(req);
    const { profileId } = req.body ?? {};
    if (!mongoose.isValidObjectId(profileId)) {
      throw appError('E-INPUT-01', {
        details: { profileId: 'Choose one of your device profiles.' },
      });
    }
    const profile = await DeviceProfile.findOne({ _id: profileId, user: req.user._id });
    if (!profile) throw appError('E-NOTFOUND-01', { message: 'Device profile not found.' });

    const recommendation = recommend(job.variants, profile);
    if (job.fake) recommendation.explanation = `FAKE DATA — ${recommendation.explanation}`;
    res.json({
      profile: { _id: profile._id, name: profile.name, preference: profile.preference },
      recommendation: { ...recommendation, ruleText: RULES[recommendation.ruleFired] ?? null },
      baselines: compareWithBaselines(job.variants, profile), // E3: next to the naive choices
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/:id/export?format=csv|json — the results as a file to save.
export async function exportResults(req, res, next) {
  try {
    const format = req.query.format ?? 'csv';
    if (format !== 'csv' && format !== 'json') {
      throw appError('E-INPUT-01', { details: { format: 'Use format=csv or format=json.' } });
    }
    const results = buildResults(await findCompletedJob(req));
    res.attachment(exportFileName(results, format)); // tells the browser to save it as a file
    if (format === 'csv') res.type('text/csv').send(toCsv(results));
    else res.json(toJson(results));
  } catch (err) {
    next(err);
  }
}
