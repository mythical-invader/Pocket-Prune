// resultController.js — the Results of a finished job: every file compared with F16.
// Only the owner can see them, and only once the job has COMPLETED.
// SRS: REQ-17, REQ-20, REQ-28, REQ-32. Owner: Huzaifah (WP-15).
import Job from '../models/Job.js';
import { buildResults } from '../services/resultsService.js';
import { appError } from '../utils/errors.js';

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
    res.json(buildResults(job));
  } catch (err) {
    next(err);
  }
}
