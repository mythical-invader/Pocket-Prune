// worker.test.js — the worker loop on the in-memory MongoDB: atomic pick of the oldest job,
// COMPLETED / FAILED / CANCELLED endings, recovery of stuck jobs, real vs fake pipeline.
// Both pipelines are replaced by small mocks, so no llama.cpp or internet is needed.
// SRS: REQ-11 – REQ-16, REQ-26. Owner: Sibghatullah (WP-11).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import CatalogModel from '../models/CatalogModel.js';
import DeviceProfile from '../models/DeviceProfile.js';
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import { jobDir, runPipeline as realPipeline } from '../worker/pipeline.js';
import { runPipeline as fakePipeline } from '../worker/fakePipeline.js';
import { pickNextJob, processJob, recoverStuckJobs, workOnce, STALE_MS } from '../worker/worker.js';
import { appError } from '../utils/errors.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/testDb.js';

// Keep the real jobDir() (where a job's files live); only the pipeline run is replaced.
vi.mock('../worker/pipeline.js', async (original) => ({
  ...(await original()),
  runPipeline: vi.fn(),
}));
vi.mock('../worker/fakePipeline.js', () => ({ runPipeline: vi.fn() }));

// A throw-away data folder, so the clean-up tests never touch the real data/.
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-worker-'));
beforeAll(async () => {
  settings.dataDir = tmpData;
  await startTestDb();
});
afterEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});
afterAll(async () => {
  await stopTestDb();
  fs.rmSync(tmpData, { recursive: true, force: true });
});

// Pretend a job already wrote some files, like a real pipeline would.
function makeJobFiles(jobId) {
  const dir = jobDir(jobId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'model-F16.gguf'), 'half-written');
  return dir;
}

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

  it('gives the pipeline the device profile and saves its recommendation (WP-18)', async () => {
    const profile = await DeviceProfile.create({
      user: new mongoose.Types.ObjectId(),
      name: 'Office laptop',
      ramMb: 8192,
      freeDiskMb: 20000,
      cpuThreads: 8,
      preference: 'speed',
    });
    realPipeline.mockImplementation(async (job) => ({
      variants: VARIANTS,
      recommendation: {
        chosenLevel: 'Q4_K_M',
        ruleFired: job.profile.preference, // proves the profile was loaded, not just its id
        explanation: `For "${job.profile.name}"…`,
      },
    }));
    const queued = await queueJob({ profile: profile._id });
    await processJob(await pickNextJob(), { useFake: false });

    const saved = await Job.findById(queued._id);
    expect(saved.recommendation).toMatchObject({
      chosenLevel: 'Q4_K_M',
      ruleFired: 'speed',
      explanation: 'For "Office laptop"…',
      qualityRisk: false,
    });
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

  it('saves whether the job ran in demo mode (shorter tests → "Demo mode" badge)', async () => {
    realPipeline.mockResolvedValue({ variants: VARIANTS, llamaCppRef: 'b12376', demoMode: true });
    const queued = await queueJob();
    await processJob(await pickNextJob(), { useFake: false });
    expect((await Job.findById(queued._id)).demoMode).toBe(true);
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

describe('clean-up of jobs that do not finish (WP-13)', () => {
  it('a FAILED job leaves no files behind (also with the fake pipeline)', async () => {
    const queued = await queueJob();
    const dir = makeJobFiles(queued._id);
    fakePipeline.mockRejectedValue(appError('E-QNT-01'));
    await processJob(await pickNextJob(), { useFake: true });

    expect((await Job.findById(queued._id)).status).toBe('FAILED');
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('a CANCELLED job leaves no files behind', async () => {
    const queued = await queueJob();
    const dir = makeJobFiles(queued._id);
    realPipeline.mockImplementation(async (job, report) => {
      await Job.updateOne({ _id: job._id }, { cancelRequested: true });
      await report.stage('CONVERTING', 'Converting');
    });
    await processJob(await pickNextJob(), { useFake: false });

    expect((await Job.findById(queued._id)).status).toBe('CANCELLED');
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("a crashed worker's job loses its files when it is recovered", async () => {
    const old = new Date(Date.now() - STALE_MS - 1000);
    const stuck = await queueJob({ status: 'CONVERTING', heartbeatAt: old });
    const dir = makeJobFiles(stuck._id);
    await recoverStuckJobs();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('a COMPLETED job keeps its files', async () => {
    const queued = await queueJob();
    const dir = makeJobFiles(queued._id);
    realPipeline.mockImplementation(goodPipeline);
    await processJob(await pickNextJob(), { useFake: false });
    expect(fs.existsSync(dir)).toBe(true);
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
