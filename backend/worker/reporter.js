// reporter.js — how a pipeline tells the outside world what it is doing.
// A pipeline only calls report.stage(...) and report.log(...); it doesn't care where that goes:
//   consoleReporter() → prints to the terminal (cli.js, no database needed — REQ-16)
//   dbReporter(job)   → updates the Job and saves JobEvents (the worker, WP-11; the website
//                       reads them for the Progress page)
// SRS: REQ-14 (tool output in the job log), REQ-26 (status, stage, percentage). Owner: Sibghatullah.
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';

// Rough share of the whole job reached when each stage STARTS (shown as the progress bar).
export const STAGE_PROGRESS = {
  DOWNLOADING: 5,
  CONVERTING: 20,
  QUANTIZING: 35,
  VALIDATING: 50,
  BENCHMARKING: 60,
  EVALUATING: 75,
  RECOMMENDING: 90,
  COMPLETED: 100,
};

export function consoleReporter() {
  let current = 'QUEUED';
  return {
    async stage(status, text) {
      current = status;
      console.log(`\n[${STAGE_PROGRESS[status] ?? 0}%] ${status} — ${text}`);
    },
    async log(message, level = 'info') {
      const mark = level === 'error' ? '✖' : level === 'warn' ? '!' : ' ';
      console.log(`  ${mark} [${current}] ${message}`);
    },
  };
}

export function dbReporter(job) {
  let current = job.status;
  return {
    async stage(status, text) {
      current = status;
      const update = { status, stage: text, progressPct: STAGE_PROGRESS[status] ?? 0 };
      await Job.updateOne({ _id: job._id }, { ...update, heartbeatAt: new Date() });
      await JobEvent.create({ job: job._id, stage: status, message: text });
    },
    async log(message, level = 'info') {
      await JobEvent.create({ job: job._id, stage: current, level, message });
    },
  };
}
