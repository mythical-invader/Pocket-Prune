// worker.test.js — the worker loop on the in-memory MongoDB: atomic pick of the oldest job,
// COMPLETED / FAILED / CANCELLED endings, recovery of stuck jobs, real vs fake pipeline.
// Both pipelines are replaced by small mocks, so no llama.cpp or internet is needed.
// SRS: REQ-11 – REQ-16, REQ-26. Owner: Sibghatullah (WP-11).
import mongoose from 'mongoose';
import { vi } from 'vitest';
import CatalogModel from '../models/CatalogModel.js';
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import { runPipeline as realPipeline } from '../worker/pipeline.js';
import { runPipeline as fakePipeline } from '../worker/fakePipeline.js';
import { pickNextJob, processJob, recoverStuckJobs, workOnce, STALE_MS } from '../worker/worker.js';
import { appError } from '../utils/errors.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/testDb.js';

vi.mock('../worker/pipeline.js', () => ({ runPipeline: vi.fn() }));
vi.mock('../worker/fakePipeline.js', () => ({ runPipeline: vi.fn() }));

beforeAll(startTestDb);
afterEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});
afterAll(stopTestDb);

const VARIANTS = [
  { level: 'F16', filePath: 'x-F16.gguf', fileSizeMb: 258.3, sha256: 'a', smokePassed: true },
  { level: 'Q4_K_M', filePath: 'x-Q4.gguf', fileSizeMb: 100.6, sha256: 'b', smokePassed: true },
];

// A pipeline mock that goes through two stages like the real one, then returns variants.
async function goodPipeline(job, report) {
  await report.stage('DOWNLOADING', 'Downloading');
  await report.stage('CONVERTING', 'Converting');
  return { variants: VARIANTS, llamaCppRef: 'b12376' };
}

let model;
beforeEach(async () => {
  model = await CatalogModel.create({
    hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
    displayName: 'SmolLM2 135M Instruct',
    paramsBillion: 0.135,
    license: 'Apache-2.0',
    f16SizeMb: 259,
  });
});

const queueJob = (extra = {}) =>
  Job.create({
    user: new mongoose.Types.ObjectId(),
    model: model._id,
    profile: new mongoose.Types.ObjectId(),
    quantLevels: ['Q4_K_M'],
    ...extra,
  });

describe('pickNextJob', () => {
  it('takes the OLDEST queued job and marks it DOWNLOADING', async () => {
    const older = await queueJob({ createdAt: new Date('2026-11-01') });
    await queueJob({ createdAt: new Date('2026-11-02') });

    const job = await pickNextJob();
    expect(String(job._id)).toBe(String(older._id));
    expect(job.status).toBe('DOWNLOADING');
    expect(job.startedAt).toBeInstanceOf(Date);
    expect(job.heartbeatAt).toBeInstanceOf(Date);
  });

  it('never gives the same job to two workers asking at the same time', async () => {
    await queueJob();
    const [a, b] = await Promise.all([pickNextJob(), pickNextJob()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('returns null when nothing is queued', async () => {
    expect(await pickNextJob()).toBeNull();
  });
});

describe('processJob', () => {
  it('saves a finished job as COMPLETED with its variants', async () => {
    realPipeline.mockImplementation(goodPipeline);
    await queueJob();
    await processJob(await pickNextJob(), { useFake: false });

    // the pipeline got the full catalog model (it needs the repo id and revision)
    expect(realPipeline.mock.calls[0][0].model.hfRepoId).toBe(
      'HuggingFaceTB/SmolLM2-135M-Instruct'
    );

    const saved = await Job.findById((await Job.findOne())._id);
    expect(saved.status).toBe('COMPLETED');
    expect(saved.progressPct).toBe(100);
    expect(saved.variants.map((v) => v.level)).toEqual(['F16', 'Q4_K_M']);
    expect(saved.llamaCppRef).toBe('b12376');
    expect(saved.fake).toBe(false);
    expect(saved.finishedAt).toBeInstanceOf(Date);
    const messages = (await JobEvent.find({ job: saved._id })).map((e) => e.message);
    expect(messages.some((m) => m.includes('2 of 2 files passed'))).toBe(true);
  });

  it('saves a pipeline error as FAILED with its error code and hint in the log', async () => {
    realPipeline.mockRejectedValue(appError('E-HF-01'));
    const queued = await queueJob();
    await processJob(await pickNextJob(), { useFake: false });

    const saved = await Job.findById(queued._id);
    expect(saved.status).toBe('FAILED');
    expect(saved.errorCode).toBe('E-HF-01');
    const error = await JobEvent.findOne({ job: queued._id, level: 'error' });
    expect(error.message).toMatch(/E-HF-01.*How to fix: Set HF_TOKEN/);
  });

  it('fails at once with E-CAT-01 when the catalog model was deleted (never left "running")', async () => {
    const queued = await queueJob();
    await CatalogModel.deleteMany({});
    await processJob(await pickNextJob(), { useFake: false });

    expect(realPipeline).not.toHaveBeenCalled();
    const saved = await Job.findById(queued._id);
    expect(saved.status).toBe('FAILED');
    expect(saved.errorCode).toBe('E-CAT-01');
  });

  it('turns an unexpected crash into E-SERVER-01 instead of stopping the worker', async () => {
    realPipeline.mockRejectedValue(new TypeError('something broke'));
    const queued = await queueJob();
    await expect(processJob(await pickNextJob(), { useFake: false })).resolves.toBeUndefined();

    const saved = await Job.findById(queued._id);
    expect(saved.status).toBe('FAILED');
    expect(saved.errorCode).toBe('E-SERVER-01');
    expect(saved.errorMessage).toBe('something broke');
  });

  it('stops before the next stage when the user asked to cancel', async () => {
    let stagesRun = 0;
    realPipeline.mockImplementation(async (job, report) => {
      await report.stage('DOWNLOADING', 'Downloading');
      stagesRun++;
      await Job.updateOne({ _id: job._id }, { cancelRequested: true }); // user presses Cancel
      await report.stage('CONVERTING', 'Converting'); // must not start
      stagesRun++;
      return { variants: VARIANTS };
    });
    const queued = await queueJob();
    await processJob(await pickNextJob(), { useFake: false });

    expect(stagesRun).toBe(1);
    const saved = await Job.findById(queued._id);
    expect(saved.status).toBe('CANCELLED');
    expect(saved.errorCode).toBeUndefined();
  });

  it('uses the fake pipeline when asked, and marks the job fake', async () => {
    fakePipeline.mockResolvedValue({ variants: VARIANTS, llamaCppRef: 'fake', fake: true });
    const queued = await queueJob();
    await processJob(await pickNextJob(), { useFake: true });

    expect(fakePipeline).toHaveBeenCalledTimes(1);
    expect(realPipeline).not.toHaveBeenCalled();
    expect((await Job.findById(queued._id)).fake).toBe(true);
  });
});

describe('recoverStuckJobs', () => {
  it('fails running jobs whose heartbeat is too old (E-WORKER-01), and only those', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - STALE_MS - 1000);
    const stuck = await queueJob({ status: 'QUANTIZING', heartbeatAt: old });
    const alive = await queueJob({ status: 'QUANTIZING', heartbeatAt: now });
    const waiting = await queueJob();

    expect(await recoverStuckJobs(now)).toBe(1);
    expect((await Job.findById(stuck._id)).errorCode).toBe('E-WORKER-01');
    expect((await Job.findById(alive._id)).status).toBe('QUANTIZING');
    expect((await Job.findById(waiting._id)).status).toBe('QUEUED');
  });
});

describe('workOnce', () => {
  it('returns false when there is nothing to do, true after running a job', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await workOnce({ useFake: false })).toBe(false);

    realPipeline.mockImplementation(goodPipeline);
    await queueJob();
    expect(await workOnce({ useFake: false })).toBe(true);
    expect((await Job.findOne()).status).toBe('COMPLETED');
  });
});
