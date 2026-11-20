// resultController.js — the Results of a finished job: every file compared with F16.
// Only the owner can see them, and only once the job has COMPLETED.
// SRS: REQ-17, REQ-20, REQ-28, REQ-30, REQ-32. Owner: Huzaifah (WP-15, WP-17).
import Job from '../models/Job.js';
import { buildResults } from '../services/resultsService.js';
import { appError } from '../utils/errors.js';
import { onThisServer } from '../utils/artifactFiles.js';

// GET /api/jobs/:id/results
export async function getResults(req, res, next) {
  try {
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
