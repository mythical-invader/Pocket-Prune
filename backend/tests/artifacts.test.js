// artifacts.test.js — the Downloads list and GET /api/artifacts/:jobId/:level/download:
// own files only, deleted F16 not offered, files outside data/artifacts never sent, and a clear
// message when the file is on the other laptop. Uses a temporary data folder with tiny files.
// SRS: REQ-30, REQ-32. Owner: Huzaifah (WP-17).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../app.js';
import { settings } from '../config/settings.js';
import CatalogModel from '../models/CatalogModel.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterAll(stopTestDb);

const realDataDir = settings.dataDir;
let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-artifacts-'));
  settings.dataDir = tmp;
});
afterEach(async () => {
  settings.dataDir = realDataDir;
  fs.rmSync(tmp, { recursive: true, force: true });
  await clearTestDb();
});

// A completed job with a deleted F16, a real Q4_K_M file and a Q5_K_M that failed its test.
async function makeJob({ user } = {}) {
  const demo = await User.findOneAndUpdate(
    { email: settings.demoUserEmail },
    { $setOnInsert: { passwordHash: 'x' } },
    { upsert: true, returnDocument: 'after' }
  );
  const model = await CatalogModel.create({
    hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
    displayName: 'SmolLM2 135M Instruct',
    paramsBillion: 0.135,
    license: 'Apache-2.0',
    f16SizeMb: 259,
  });
  const job = await Job.create({
    user: user ?? demo._id,
    model: model._id,
    profile: model._id, // any id: the profile isn't used here
    quantLevels: ['Q5_K_M', 'Q4_K_M'],
    status: 'COMPLETED',
    finishedAt: new Date(),
  });
  const dir = path.join(tmp, 'artifacts', String(job._id));
  fs.mkdirSync(dir, { recursive: true });
  const q4 = path.join(dir, 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
  fs.writeFileSync(q4, 'GGUF test bytes');
  job.variants = [
    {
      level: 'F16',
      filePath: path.join(dir, 'x-F16.gguf'),
      fileSizeMb: 258.3,
      smokePassed: true,
      fileDeleted: true,
    },
    {
      level: 'Q5_K_M',
      filePath: path.join(dir, 'x-Q5.gguf'),
      fileSizeMb: 106.9,
      smokePassed: false,
    },
    { level: 'Q4_K_M', filePath: q4, fileSizeMb: 100.6, sha256: 'c'.repeat(64), smokePassed: true },
  ];
  await job.save();
  return job;
}

describe('GET /api/artifacts', () => {
  it('lists files that passed, marks the deleted F16 and which files are on this server', async () => {
    const job = await makeJob();

    const res = await request(app).get('/api/artifacts');

    expect(res.status).toBe(200);
    expect(res.body.map((f) => f.level)).toEqual(['F16', 'Q4_K_M']); // Q5 failed → not listed
    expect(res.body[0]).toMatchObject({ fileDeleted: true, onThisServer: false });
    expect(res.body[1]).toMatchObject({
      jobId: String(job._id),
      model: 'SmolLM2 135M Instruct',
      fileDeleted: false,
      onThisServer: true,
    });
  });
});

describe('GET /api/artifacts/:jobId/:level/download', () => {
  it('sends the file with a clear name', async () => {
    const job = await makeJob();

    const res = await request(app).get(`/api/artifacts/${job._id}/Q4_K_M/download`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('SmolLM2-135M-Instruct-Q4_K_M.gguf');
    expect(res.text ?? res.body.toString()).toContain('GGUF test bytes');
  });

  it('refuses the deleted F16 baseline with an explanation', async () => {
    const job = await makeJob();

    const res = await request(app).get(`/api/artifacts/${job._id}/F16/download`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/deleted after evaluation/);
  });

  it('refuses a file that failed its smoke test, and an unknown level', async () => {
    const job = await makeJob();
    expect((await request(app).get(`/api/artifacts/${job._id}/Q5_K_M/download`)).status).toBe(404);
    expect((await request(app).get(`/api/artifacts/${job._id}/Q8_0/download`)).status).toBe(404);
  });

  it('says where the file is when it is not on this server', async () => {
    const job = await makeJob();
    fs.rmSync(path.join(tmp, 'artifacts'), { recursive: true }); // as if the job ran elsewhere

    const res = await request(app).get(`/api/artifacts/${job._id}/Q4_K_M/download`);

    expect(res.status).toBe(404);
    expect(res.body.hint).toMatch(/model machine/);
  });

  it('never sends a file outside data/artifacts, whatever the database says', async () => {
    const job = await makeJob();
    const outside = path.join(tmp, 'secret.txt');
    fs.writeFileSync(outside, 'do not send');
    await Job.updateOne(
      { _id: job._id, 'variants.level': 'Q4_K_M' },
      { $set: { 'variants.$.filePath': outside } }
    );

    const res = await request(app).get(`/api/artifacts/${job._id}/Q4_K_M/download`);

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('do not send');
  });

  it("doesn't send another user's file", async () => {
    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });
    const job = await makeJob({ user: other._id });

    expect((await request(app).get(`/api/artifacts/${job._id}/Q4_K_M/download`)).status).toBe(404);
    expect((await request(app).get('/api/artifacts')).body).toEqual([]);
  });
});
