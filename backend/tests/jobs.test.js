// jobs.test.js — create a job (202), the preflight gate, list, status + log, queue position,
// the 2-job limit and "own jobs only". Free disk and llama.cpp are mocked.
// SRS: REQ-6 – REQ-10, REQ-26, REQ-32. Owner: Huzaifah (WP-10).
import mongoose from 'mongoose';
import request from 'supertest';
import { vi } from 'vitest';
import app from '../app.js';
import CatalogModel from '../models/CatalogModel.js';
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import User from '../models/User.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

vi.mock('../utils/systemInfo.js', () => ({ getFreeDiskMb: vi.fn(async () => 500_000) }));
vi.mock('../worker/llamacpp.js', () => ({ checkInstalled: vi.fn(() => 'b12376') }));

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

async function setup() {
  const model = await CatalogModel.create({
    hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
    displayName: 'SmolLM2 135M Instruct',
    paramsBillion: 0.135,
    license: 'Apache-2.0',
    f16SizeMb: 259,
  });
  const { body: profile } = await request(app)
    .post('/api/profiles')
    .send({ name: 'My laptop', ramMb: 16384, freeDiskMb: 100000, cpuThreads: 8 });
  return {
    modelId: model._id,
    profileId: profile._id,
    levels: ['Q5_K_M', 'Q4_K_M'],
    licenseAccepted: true,
  };
}

describe('POST /api/jobs', () => {
  it('creates a QUEUED job and answers 202 { jobId } quickly', async () => {
    const body = await setup();

    const started = Date.now();
    const res = await request(app).post('/api/jobs').send(body);

    expect(res.status).toBe(202);
    expect(Date.now() - started).toBeLessThan(1000); // REQ-10: within 1 s
    const job = await Job.findById(res.body.jobId);
    expect(job).toMatchObject({ status: 'QUEUED', progressPct: 0 });
    expect(job.quantLevels).toEqual(['Q5_K_M', 'Q4_K_M']);
    expect(await JobEvent.countDocuments({ job: job._id })).toBe(1);
  });

  it('refuses when preflight fails, with the first code and every failed check', async () => {
    const body = await setup();

    const res = await request(app)
      .post('/api/jobs')
      .send({ ...body, levels: ['F16'], licenseAccepted: false });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('E-LVL-01');
    expect(Object.keys(res.body.details)).toEqual(['levels', 'licence']);
    expect(await Job.countDocuments()).toBe(0);
  });

  it('only counts licenseAccepted === true (not "yes")', async () => {
    const body = await setup();
    const res = await request(app)
      .post('/api/jobs')
      .send({ ...body, licenseAccepted: 'yes' });
    expect(res.body.code).toBe('E-LIC-01');
  });

  it('allows 2 active jobs and refuses the third with E-LIMIT-01 (429)', async () => {
    const body = await setup();

    expect((await request(app).post('/api/jobs').send(body)).status).toBe(202);
    expect((await request(app).post('/api/jobs').send(body)).status).toBe(202);
    const third = await request(app).post('/api/jobs').send(body);

    expect(third.status).toBe(429);
    expect(third.body.code).toBe('E-LIMIT-01');
  });
});

describe('GET /api/jobs and /api/jobs/:id', () => {
  it('lists own jobs newest first, with model and profile names', async () => {
    const body = await setup();
    const { body: first } = await request(app).post('/api/jobs').send(body);
    const { body: second } = await request(app).post('/api/jobs').send(body);

    const res = await request(app).get('/api/jobs');

    expect(res.body.map((j) => j._id)).toEqual([second.jobId, first.jobId]);
    expect(res.body[0].model.displayName).toBe('SmolLM2 135M Instruct');
    expect(res.body[0].profile.name).toBe('My laptop');
  });

  it('returns status, queue position and log lines in reading order', async () => {
    const body = await setup();
    const { body: first } = await request(app).post('/api/jobs').send(body);
    const { body: second } = await request(app).post('/api/jobs').send(body);
    await JobEvent.create({ job: second.jobId, stage: 'QUEUED', message: 'second line' });

    const res = await request(app).get(`/api/jobs/${second.jobId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'QUEUED', queuePosition: 2 });
    expect(res.body.events.map((e) => e.message)).toEqual([
      expect.stringContaining('Job created'),
      'second line',
    ]);
    expect((await request(app).get(`/api/jobs/${first.jobId}`)).body.queuePosition).toBe(1);
  });

  it('sends only the latest 50 log lines', async () => {
    const body = await setup();
    const { body: created } = await request(app).post('/api/jobs').send(body);
    await JobEvent.insertMany(
      Array.from({ length: 60 }, (_, i) => ({
        job: created.jobId,
        stage: 'QUANTIZING',
        message: `line ${i}`,
      }))
    );

    const { body: job } = await request(app).get(`/api/jobs/${created.jobId}`);

    expect(job.events).toHaveLength(50);
    expect(job.events.at(-1).message).toBe('line 59');
  });

  it("treats another user's job, an unknown id and a bad id as not found", async () => {
    const body = await setup();
    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });
    const theirs = await Job.create({
      user: other._id,
      model: body.modelId,
      profile: body.profileId,
      quantLevels: ['Q4_K_M'],
    });

    for (const id of [theirs._id, new mongoose.Types.ObjectId(), 'abc']) {
      const res = await request(app).get(`/api/jobs/${id}`);
      expect(res.status).toBe(404);
    }
    expect((await request(app).get('/api/jobs')).body).toEqual([]);
  });

  it('adds the how-to-fix hint for a failed job (and none for a running one)', async () => {
    const body = await setup();
    const { body: created } = await request(app).post('/api/jobs').send(body);

    expect((await request(app).get(`/api/jobs/${created.jobId}`)).body.errorHint).toBeNull();

    await Job.updateOne(
      { _id: created.jobId },
      { status: 'FAILED', errorCode: 'E-HF-01', errorMessage: 'Gated model.' }
    );
    const res = await request(app).get(`/api/jobs/${created.jobId}`);

    expect(res.body).toMatchObject({ status: 'FAILED', errorCode: 'E-HF-01', queuePosition: null });
    expect(res.body.errorHint).toMatch(/HF_TOKEN/);
  });
});
