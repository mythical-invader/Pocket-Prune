// results.test.js — change vs F16, the size-estimate error (E1), which numbers exist, and
// GET /api/jobs/:id/results (completed jobs only, owner only). SRS: REQ-20, REQ-28.
// Owner: Huzaifah (WP-15).
import request from 'supertest';
import app from '../app.js';
import { settings } from '../config/settings.js';
import CatalogModel from '../models/CatalogModel.js';
import DeviceProfile from '../models/DeviceProfile.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { buildResults, compareVariant, pctChange } from '../services/resultsService.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

// Numbers from the WP-02 hand trial (SmolLM2-135M), the same ones the fake pipeline uses.
const F16 = {
  level: 'F16',
  fileSizeMb: 258.3,
  smokePassed: true,
  metrics: { tpsPrompt: 2188, tpsGen: 105, peakRamMb: 471, perplexity: 18.92 },
};
const Q4 = {
  level: 'Q4_K_M',
  fileSizeMb: 100.6,
  smokePassed: true,
  metrics: { tpsPrompt: 974, tpsGen: 199, peakRamMb: 320, perplexity: 19.87 },
};

describe('pctChange', () => {
  it('is (value − base) ÷ base × 100, rounded to 0.1', () => {
    expect(pctChange(100.6, 258.3)).toBe(-61.1);
    expect(pctChange(199, 105)).toBe(89.5);
    expect(pctChange(19.87, 18.92)).toBe(5);
  });

  it('is null when a number is missing or the base is 0', () => {
    expect(pctChange(null, 10)).toBeNull();
    expect(pctChange(5, undefined)).toBeNull();
    expect(pctChange(5, 0)).toBeNull();
  });
});

describe('compareVariant', () => {
  it('compares every metric with F16 and leaves F16 itself without a change', () => {
    const q4 = compareVariant(Q4, F16, 259);
    expect(q4.vsF16).toEqual({
      fileSizeMb: -61.1,
      tpsPrompt: -55.5,
      tpsGen: 89.5,
      peakRamMb: -32.1,
      perplexity: 5,
      taskAccuracy: null, // WP-16 added this metric; these test files have no accuracy yet
    });
    expect(compareVariant(F16, F16, 259).vsF16.fileSizeMb).toBeNull();
  });

  it('E1: shows the estimate made before the job and how far off it was', () => {
    // Estimate: 259 × 4.9 / 16 = 79.32 MB; the real file is 100.6 MB → 21 % too small.
    const q4 = compareVariant(Q4, F16, 259);
    expect(q4.estimatedSizeMb).toBe(79.3);
    expect(q4.estimateErrorPct).toBe(-21.2);
  });
});

describe('buildResults', () => {
  it('orders F16 first and lists only the numbers that were measured', () => {
    // A real Phase 2 job: sizes + smoke tests, no speed/RAM/perplexity yet.
    const job = {
      status: 'COMPLETED',
      model: { f16SizeMb: 259 },
      variants: [
        { level: 'Q4_K_M', fileSizeMb: 100.6, smokePassed: true },
        { level: 'F16', fileSizeMb: 258.3, smokePassed: true },
      ],
    };
    const results = buildResults(job);
    expect(results.rows.map((r) => r.level)).toEqual(['F16', 'Q4_K_M']);
    expect(results.measured).toEqual(['fileSizeMb']);
    expect(results.recommendation).toBeNull();
  });
});

describe('GET /api/jobs/:id/results', () => {
  async function makeJob(fields) {
    const model = await CatalogModel.create({
      hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
      revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
      displayName: 'SmolLM2 135M Instruct',
      paramsBillion: 0.135,
      license: 'Apache-2.0',
      f16SizeMb: 259,
    });
    const demo = await User.findOneAndUpdate(
      { email: settings.demoUserEmail },
      { $setOnInsert: { passwordHash: 'x' } },
      { upsert: true, returnDocument: 'after' }
    );
    const profile = await DeviceProfile.create({
      user: demo._id,
      name: 'My laptop',
      ramMb: 16384,
      freeDiskMb: 100000,
      cpuThreads: 8,
    });
    return Job.create({
      user: demo._id,
      model: model._id,
      profile: profile._id,
      quantLevels: ['Q4_K_M'],
      ...fields,
    });
  }

  it('returns the comparison for a completed job', async () => {
    const job = await makeJob({ status: 'COMPLETED', variants: [F16, Q4], fake: true });

    const res = await request(app).get(`/api/jobs/${job._id}/results`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'COMPLETED', fake: true });
    expect(res.body.model.displayName).toBe('SmolLM2 135M Instruct');
    expect(res.body.rows[1]).toMatchObject({ level: 'Q4_K_M', vsF16: { tpsGen: 89.5 } });
    expect(res.body.measured).toHaveLength(5);
  });

  it('answers 404 with a clear message while the job is still running', async () => {
    const job = await makeJob({ status: 'QUANTIZING' });

    const res = await request(app).get(`/api/jobs/${job._id}/results`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not finished/);
  });

  it("doesn't show another user's results", async () => {
    const job = await makeJob({ status: 'COMPLETED', variants: [F16, Q4] });
    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });
    await Job.updateOne({ _id: job._id }, { user: other._id });

    expect((await request(app).get(`/api/jobs/${job._id}/results`)).status).toBe(404);
  });
});
