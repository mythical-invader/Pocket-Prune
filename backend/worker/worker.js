// worker.js — the background process that runs compression jobs, one at a time.
// The API (WP-10) only saves a job as QUEUED. This separate Node process:
//   1. every 3 s takes the OLDEST queued job in one atomic step (so it can never be taken twice),
//   2. runs the pipeline on it (pipeline.js, or fakePipeline.js when FAKE_PIPELINE=true),
//   3. writes a heartbeat every 10 s, so a crashed worker can be noticed,
//   4. checks the cancel flag between stages,
//   5. saves the result: COMPLETED with the variants, FAILED with an error code, or CANCELLED.
// Jobs left "running" by a crashed worker (heartbeat older than 60 s) become FAILED (E-WORKER-01).
// Start it with: npm run dev:worker   (needs MongoDB; real jobs also need llama.cpp)
// SRS: REQ-11 – REQ-16, REQ-26. Owner: Sibghatullah (WP-11).
import path from 'node:path';
import { settings } from '../config/settings.js';
import { connectDB, disconnectDB } from '../config/db.js';
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import '../models/CatalogModel.js'; // registers the model, so job.populate('model') works
import { appError } from '../utils/errors.js';
import { runPipeline as realPipeline } from './pipeline.js';
import { runPipeline as fakePipeline } from './fakePipeline.js';
import { dbReporter } from './reporter.js';

export const POLL_MS = 3_000; // how often an idle worker looks for a new job
export const HEARTBEAT_MS = 10_000; // how often a busy worker says "still alive"
export const STALE_MS = 60_000; // no heartbeat for this long → the worker must have died

// Statuses of a job that is being worked on right now (not waiting, not finished).
export const RUNNING = [
  'DOWNLOADING',
  'CONVERTING',
  'QUANTIZING',
  'VALIDATING',
  'BENCHMARKING',
  'EVALUATING',
  'RECOMMENDING',
];

let currentJobId = null; // the job this worker is running (used when it is stopped with Ctrl+C)

// Take the oldest queued job in ONE database step: find + mark it DOWNLOADING together.
// Two workers asking at the same moment can never get the same job.
export async function pickNextJob() {
  const now = new Date();
  return Job.findOneAndUpdate(
    { status: 'QUEUED' },
    { status: 'DOWNLOADING', stage: 'Starting', startedAt: now, heartbeatAt: now },
    { sort: { createdAt: 1 }, returnDocument: 'after' } // give back the job AFTER the change
  );
}

// A job is "stuck" when it says it is running but nobody has updated its heartbeat for 60 s:
// the worker running it crashed or was closed. Mark it FAILED so the user can retry it.
export async function recoverStuckJobs(now = new Date()) {
  const stuck = await Job.find({
    status: { $in: RUNNING },
    heartbeatAt: { $lt: new Date(now.getTime() - STALE_MS) },
  });
  for (const job of stuck) await failJob(job._id, appError('E-WORKER-01'));
  return stuck.length;
}

// Run one job from start to end and save how it ended. Never throws: every outcome is saved.
export async function processJob(job, { useFake = settings.fakePipeline } = {}) {
  currentJobId = job._id;
  const runPipeline = useFake ? fakePipeline : realPipeline;
  const heartbeat = setInterval(() => {
    Job.updateOne({ _id: job._id }, { heartbeatAt: new Date() }).catch(() => {});
  }, HEARTBEAT_MS);

  try {
    // Load the catalog model here, inside try: if anything fails from now on, the job is
    // saved as FAILED at once instead of being left "running".
    await job.populate('model'); // the pipeline needs hfRepoId, revision and f16SizeMb
    if (!job.model) throw appError('E-CAT-01'); // the catalog model was deleted meanwhile
    await JobEvent.create({
      job: job._id,
      stage: job.status,
      message: `Worker picked up the job (${useFake ? 'FAKE pipeline' : `llama.cpp ${settings.llamaCppRef}`}).`,
    });

    const result = await runPipeline(job, cancellableReporter(job));

    await Job.updateOne(
      { _id: job._id },
      {
        status: 'COMPLETED',
        stage: 'Finished',
        progressPct: 100,
        variants: result.variants,
        llamaCppRef: result.llamaCppRef,
        // only the fake pipeline returns a recommendation until the recommender (WP-18)
        ...(result.recommendation && { recommendation: result.recommendation }),
        fake: Boolean(result.fake),
        finishedAt: new Date(),
      }
    );
    const files = result.variants.filter((v) => v.smokePassed).length;
    await JobEvent.create({
      job: job._id,
      stage: 'COMPLETED',
      message: `Job finished: ${files} of ${result.variants.length} files passed the smoke test.`,
    });
  } catch (err) {
    if (err.cancelled) await cancelJob(job._id);
    else await failJob(job._id, err);
  } finally {
    clearInterval(heartbeat);
    currentJobId = null;
  }
}

// The normal database reporter, plus a cancel check before every new stage: if the user
// pressed Cancel, the pipeline stops here (between stages) instead of starting the next one.
export function cancellableReporter(job) {
  const report = dbReporter(job);
  return {
    log: report.log,
    async stage(status, text) {
      const fresh = await Job.findById(job._id).select('cancelRequested');
      if (fresh?.cancelRequested) {
        const err = new Error('Cancelled by the user.');
        err.cancelled = true;
        throw err;
      }
      return report.stage(status, text);
    },
  };
}

async function failJob(jobId, err) {
  // Errors from our code have a code (E-HF-01…); anything unexpected becomes E-SERVER-01.
  const code = err.code && err.code.startsWith('E-') ? err.code : 'E-SERVER-01';
  await Job.updateOne(
    { _id: jobId },
    {
      status: 'FAILED',
      stage: 'Failed',
      errorCode: code,
      errorMessage: err.message,
      finishedAt: new Date(),
    }
  );
  const hint = err.hint ? ` How to fix: ${err.hint}` : '';
  await JobEvent.create({
    job: jobId,
    stage: 'FAILED',
    level: 'error',
    message: `${code}: ${err.message}${hint}`,
  });
}

async function cancelJob(jobId) {
  await Job.updateOne(
    { _id: jobId },
    { status: 'CANCELLED', stage: 'Cancelled by the user', finishedAt: new Date() }
  );
  await JobEvent.create({
    job: jobId,
    stage: 'CANCELLED',
    level: 'warn',
    message: 'Job cancelled.',
  });
}

// One round of the loop: clean up stuck jobs, then run the next queued job if there is one.
// Returns true when a job was run (so the loop looks again at once instead of waiting).
export async function workOnce(options) {
  await recoverStuckJobs();
  const job = await pickNextJob();
  if (!job) return false;
  console.log(`▶ Job ${job._id}: ${job.quantLevels.join(', ')}`);
  await processJob(job, options);
  const done = await Job.findById(job._id).select('status errorCode');
  console.log(`■ Job ${job._id}: ${done.status}${done.errorCode ? ` (${done.errorCode})` : ''}`);
  return true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await connectDB(settings.mongoUri);
  console.log(
    `PocketPrune worker started — ${settings.fakePipeline ? 'FAKE pipeline' : `llama.cpp ${settings.llamaCppRef}`}. Waiting for jobs…`
  );

  // Ctrl+C: mark the running job as failed right away (instead of waiting 60 s for recovery).
  const stop = async () => {
    if (currentJobId) await failJob(currentJobId, appError('E-WORKER-01')).catch(() => {});
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  for (;;) {
    try {
      const didWork = await workOnce();
      if (!didWork) await sleep(POLL_MS);
    } catch (err) {
      // e.g. the database connection dropped for a moment — wait and try again.
      console.error(`Worker loop error: ${err.message}`);
      await sleep(POLL_MS);
    }
  }
}

// Start the loop only when run as a program (npm run dev:worker), not when tests import it.
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((err) => {
    console.error(`Worker could not start: ${err.message}`);
    process.exit(1);
  });
}
