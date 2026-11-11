// Job.js — one compression request: which model, which levels, for which device, and
// everything the pipeline produces (files, metrics, recommendation). The worker updates it
// stage by stage. SRS: REQ-6, REQ-10, REQ-14, REQ-17 – REQ-26. Owner: Huzaifah.
import mongoose from 'mongoose';

// Order matters: the website's stage stepper shows them in this order.
export const JOB_STATUSES = [
  'QUEUED',
  'DOWNLOADING',
  'CONVERTING',
  'QUANTIZING',
  'VALIDATING',
  'BENCHMARKING',
  'EVALUATING',
  'RECOMMENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];
// Levels a user may ask for. F16 is always made as the baseline, so it isn't in this list.
export const QUANT_LEVELS = ['Q5_K_M', 'Q4_K_M', 'Q8_0'];
export const VARIANT_LEVELS = ['F16', ...QUANT_LEVELS];

// Measurements of one file (filled by the evaluator in WP-14 / WP-16).
const metricsSchema = new mongoose.Schema(
  {
    tpsPrompt: Number, // prompt processing speed, tokens/s (mean of runs)
    tpsPromptStd: Number, // standard deviation across runs
    tpsGen: Number, // generation speed, tokens/s (mean of runs)
    tpsGenStd: Number,
    peakRamMb: Number,
    perplexity: Number, // lower = better quality
    runs: Number,
    unstable: { type: Boolean, default: false }, // > 10 % variation between runs
    settings: mongoose.Schema.Types.Mixed, // threads, context, chunks, dataset SHA-256…
  },
  { _id: false }
);

// One output file (F16, Q5_K_M, Q4_K_M…).
const variantSchema = new mongoose.Schema(
  {
    level: { type: String, enum: VARIANT_LEVELS, required: true },
    filePath: String, // on the server disk — files are never stored in MongoDB
    fileSizeMb: Number,
    sha256: String,
    smokePassed: Boolean,
    smokeOutput: String,
    durationSec: Number,
    expiresAt: Date,
    pinned: { type: Boolean, default: false },
    metrics: metricsSchema,
  },
  { _id: false }
);

// The recommender's answer (WP-18).
const recommendationSchema = new mongoose.Schema(
  {
    chosenLevel: String,
    baselineSmallest: String, // B1: smallest file that fits
    baselineLargest: String, // B2: largest file that fits
    ruleFired: String,
    explanation: String,
    qualityRisk: { type: Boolean, default: false },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    model: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogModel', required: true },
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceProfile', required: true },
    quantLevels: {
      type: [{ type: String, enum: QUANT_LEVELS }],
      validate: [(levels) => levels.length > 0, 'Choose at least one level.'],
    },
    status: { type: String, enum: JOB_STATUSES, default: 'QUEUED', index: true },
    stage: { type: String, default: 'Waiting in queue' }, // human-readable current step
    progressPct: { type: Number, default: 0, min: 0, max: 100 },
    demoMode: { type: Boolean, default: false },
    llamaCppRef: String,
    errorCode: String,
    errorMessage: String,
    cancelRequested: { type: Boolean, default: false },
    heartbeatAt: Date, // the worker updates this every 10 s while running
    startedAt: Date,
    finishedAt: Date,
    variants: [variantSchema],
    recommendation: recommendationSchema,
    fake: { type: Boolean, default: false }, // ⏳ TEMPORARY: made by fakePipeline.js, removed in WP-20
  },
  { timestamps: true }
);

export default mongoose.model('Job', jobSchema);
