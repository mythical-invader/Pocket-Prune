// jobController.js — compression jobs: preflight, create, list, and one job's status + log.
// The API only creates the job (status QUEUED); the worker (WP-11) picks it up and runs it.
// Every query includes `user: req.user._id`, so users only ever see their own jobs.
// SRS: REQ-6 – REQ-10, REQ-26, REQ-32. Owner: Huzaifah.
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import { runPreflight } from '../services/preflightService.js';
import { appError, ERRORS } from '../utils/errors.js';

const EVENTS_SHOWN = 50; // latest log lines sent with a job (CLAUDE.md §6)

// POST /api/jobs/preflight  { modelId, levels, profileId, licenseAccepted }
// Always answers 200 with { passed, checks[] }: a failed check is a normal answer, not an error.
export async function preflight(req, res, next) {
  try {
    res.json(await runPreflight(preflightInput(req)));
  } catch (err) {
    next(err);
  }
}

// POST /api/jobs  (same body) → 202 { jobId }
// Preflight runs again here, so nobody can skip it by calling the API directly.
export async function createJob(req, res, next) {
  try {
    const input = preflightInput(req);
    const { passed, checks } = await runPreflight(input);
    if (!passed) {
      const failed = checks.filter((c) => !c.passed);
      // Answer with the first problem's code; `details` lists every failed check.
      throw appError(failed[0].code, {
        message: failed[0].message,
        hint: failed[0].hint,
        details: Object.fromEntries(failed.map((c) => [c.id, `${c.code}: ${c.message}`])),
      });
    }

    const job = await Job.create({
      user: req.user._id,
      model: input.modelId,
      profile: input.profileId,
      quantLevels: input.levels,
    });
    await JobEvent.create({
      job: job._id,
      stage: 'QUEUED',
      message: `Job created: ${input.levels.join(', ')}. Waiting for the worker.`,
    });
    // 202 Accepted = "received, the work happens later in the background".
    res.status(202).json({ jobId: job._id });
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs — the user's jobs, newest first (without the big variants list).
export async function listJobs(req, res, next) {
  try {
    const jobs = await Job.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('-variants -recommendation')
      .populate('model', 'displayName hfRepoId')
      .populate('profile', 'name');
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

// GET /api/jobs/:id — status, stage, progress, queue position, error hint and the latest log
// lines. The Job Progress page (WP-12) asks for this every 2 s while the job runs.
export async function getJob(req, res, next) {
  try {
    const job = await Job.findOne({ _id: req.params.id, user: req.user._id })
      .populate('model', 'displayName hfRepoId revision license f16SizeMb')
      .populate('profile', 'name ramMb freeDiskMb cpuThreads preference');
    if (!job) throw appError('E-NOTFOUND-01', { message: 'Job not found.' });

    // Newest 50 events, then turned back to oldest-first for reading top to bottom.
    const events = (
      await JobEvent.find({ job: job._id }).sort({ createdAt: -1, _id: -1 }).limit(EVENTS_SHOWN)
    ).reverse();

    // Queue position (REQ-26): 1 = next to be picked up. Counts every user's queued jobs,
    // because there is one worker for everyone.
    let queuePosition = null;
    if (job.status === 'QUEUED') {
      queuePosition =
        1 + (await Job.countDocuments({ status: 'QUEUED', createdAt: { $lt: job.createdAt } }));
    }

    // A failed job stores its code and message; add the "how to fix" text from errors.js.
    const errorHint = job.errorCode ? (ERRORS[job.errorCode]?.[2] ?? null) : null;

    res.json({ ...job.toJSON(), queuePosition, errorHint, events });
  } catch (err) {
    next(err);
  }
}

// Reads the job request from the body. Only `true` counts as accepting the licence.
function preflightInput(req) {
  const { modelId, levels, profileId, licenseAccepted } = req.body;
  return { user: req.user, modelId, levels, profileId, licenseAccepted: licenseAccepted === true };
}
