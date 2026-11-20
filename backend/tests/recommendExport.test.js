// recommendExport.test.js — POST /api/jobs/:id/recommend (the recommendation for another device
// profile) and GET /api/jobs/:id/export (CSV / JSON), plus the CSV helpers.
// SRS: REQ-22, REQ-31, REQ-32. Owner: Huzaifah (WP-19).
import request from 'supertest';
import app from '../app.js';
import { settings } from '../config/settings.js';
import CatalogModel from '../models/CatalogModel.js';
import DeviceProfile from '../models/DeviceProfile.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { csvCell, toCsv } from '../services/exportService.js';
import { buildResults } from '../services/resultsService.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

// Numbers from the WP-02 hand trial (SmolLM2-135M), like the fake pipeline.
const VARIANTS = [
  {
    level: 'F16',
    fileSizeMb: 258.3,
    smokePassed: true,
    fileDeleted: true,
    metrics: { tpsPrompt: 2188, tpsGen: 105, peakRamMb: 471, perplexity: 18.92 },
  },
  {
    level: 'Q5_K_M',
    fileSizeMb: 112.9,
    smokePassed: true,
    sha256: 'aa',
    metrics: { tpsPrompt: 1500, tpsGen: 170, peakRamMb: 335, perplexity: 19.21 },
  },
  {
    level: 'Q4_K_M',
    fileSizeMb: 100.6,
    smokePassed: true,
    sha256: 'bb',
    metrics: { tpsPrompt: 974, tpsGen: 199, peakRamMb: 320, perplexity: 19.87 },
  },
];

async function demoUser() {
  return User.findOneAndUpdate(
    { email: settings.demoUserEmail },
    { $setOnInsert: { passwordHash: 'x' } },
    { upsert: true, returnDocument: 'after' }
  );
}

async function makeProfile(fields) {
  const demo = await demoUser();
  return DeviceProfile.create({
    user: demo._id,
    name: 'My laptop',
    ramMb: 16384,
    freeDiskMb: 100000,
    cpuThreads: 8,
    ...fields,
  });
}

async function makeJob(fields = {}) {
  const demo = await demoUser();
  const model = await CatalogModel.create({
    hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
    displayName: 'SmolLM2 135M Instruct',
    paramsBillion: 0.135,
    license: 'Apache-2.0',
    f16SizeMb: 259,
  });
  const profile = await makeProfile();
  return Job.create({
    user: demo._id,
    model: model._id,
    profile: profile._id,
    quantLevels: ['Q5_K_M', 'Q4_K_M'],
    status: 'COMPLETED',
    variants: VARIANTS,
    ...fields,
  });
}

describe('POST /api/jobs/:id/recommend', () => {
  it('recommends for another profile without changing the saved recommendation', async () => {
    const job = await makeJob();
    const phone = await makeProfile({ name: 'Phone', ramMb: 4096, preference: 'smallest' });

    const res = await request(app)
      .post(`/api/jobs/${job._id}/recommend`)
      .send({ profileId: phone._id });

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe('Phone');
    expect(res.body.recommendation).toMatchObject({ chosenLevel: 'Q4_K_M', ruleFired: 'smallest' });
    expect(res.body.recommendation.ruleText).toMatch(/smallest file/);
    expect(res.body.recommendation.explanation).toMatch(/"Phone"/);
    expect(res.body.baselines.map((b) => b.method)).toEqual([
      'recommender',
      'always-Q4',
      'largest-fits',
    ]);
    expect((await Job.findById(job._id)).recommendation).toBeUndefined();
  });

  it('a different preference can change the answer', async () => {
    const job = await makeJob();
    const quality = await makeProfile({ name: 'Desktop', preference: 'quality' });

    const res = await request(app)
      .post(`/api/jobs/${job._id}/recommend`)
      .send({ profileId: quality._id });

    expect(res.body.recommendation.chosenLevel).toBe('Q5_K_M'); // lower perplexity
  });

  it('says what is needed when nothing fits', async () => {
    const job = await makeJob();
    const tiny = await makeProfile({ name: 'Old phone', ramMb: 256, freeDiskMb: 500 });

    const res = await request(app)
      .post(`/api/jobs/${job._id}/recommend`)
      .send({ profileId: tiny._id });

    expect(res.body.recommendation).toMatchObject({ chosenLevel: null, ruleFired: 'nothing-fits' });
    expect(res.body.recommendation.explanation).toMatch(/needs about/);
  });

  it('marks recommendations on fake jobs', async () => {
    const job = await makeJob({ fake: true });
    const profile = await makeProfile({ name: 'Laptop 2' });

    const res = await request(app)
      .post(`/api/jobs/${job._id}/recommend`)
      .send({ profileId: profile._id });

    expect(res.body.recommendation.explanation).toMatch(/^FAKE DATA/);
  });

  it('refuses a missing profile id, another user’s profile and an unfinished job', async () => {
    const job = await makeJob();
    expect((await request(app).post(`/api/jobs/${job._id}/recommend`).send({})).body.code).toBe(
      'E-INPUT-01'
    );

    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });
    const theirs = await DeviceProfile.create({
      user: other._id,
      name: 'Theirs',
      ramMb: 8192,
      freeDiskMb: 50000,
      cpuThreads: 4,
    });
    const res = await request(app)
      .post(`/api/jobs/${job._id}/recommend`)
      .send({ profileId: theirs._id });
    expect(res.status).toBe(404);

    await Job.updateOne({ _id: job._id }, { status: 'BENCHMARKING' });
    const running = await request(app)
      .post(`/api/jobs/${job._id}/recommend`)
      .send({ profileId: theirs._id });
    expect(running.body.message).toMatch(/not finished/);
  });
});

describe('GET /api/jobs/:id/export', () => {
  it('sends a CSV file with one line per level and the settings', async () => {
    const job = await makeJob({ llamaCppRef: 'b12376', demoMode: true });

    const res = await request(app).get(`/api/jobs/${job._id}/export?format=csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/SmolLM2-135M-Instruct-results\.csv/);
    const lines = res.text.trim().split('\n');
    expect(lines).toHaveLength(4); // header + F16, Q5_K_M, Q4_K_M
    expect(lines[0]).toMatch(/^level,file_size_mb,/);
    expect(lines[3]).toMatch(/^Q4_K_M,100.6,-61.1,/);
    expect(lines[3]).toMatch(/b12376/);
    expect(lines[3]).toMatch(/,true,false,$/); // demo mode yes, fake no, no recommendation
  });

  it('sends JSON with the whole results answer', async () => {
    const job = await makeJob();

    const res = await request(app).get(`/api/jobs/${job._id}/export?format=json`);

    expect(res.headers['content-disposition']).toMatch(/results\.json/);
    expect(res.body.exportedAt).toBeTruthy();
    expect(res.body.rows).toHaveLength(3);
  });

  it('refuses an unknown format', async () => {
    const job = await makeJob();
    const res = await request(app).get(`/api/jobs/${job._id}/export?format=xlsx`);
    expect(res.status).toBe(400);
    expect(res.body.details.format).toMatch(/csv/);
  });
});

describe('CSV helpers', () => {
  it('quotes text with commas or quotes, and leaves missing numbers empty', () => {
    expect(csvCell('Intel(R) Core(TM) i7, 8 cores')).toBe('"Intel(R) Core(TM) i7, 8 cores"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });

  it('a job without measurements still gives a valid CSV', () => {
    const csv = toCsv(
      buildResults({ status: 'COMPLETED', variants: [{ level: 'Q4_K_M', fileSizeMb: 100.6 }] })
    );
    expect(csv.split('\n')[1]).toMatch(/^Q4_K_M,100.6,,/);
  });
});
