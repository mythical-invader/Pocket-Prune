// preflight.test.js — one test per preflight check, plus POST /api/jobs/preflight end to end.
// Free disk and llama.cpp are mocked so the result doesn't depend on whose laptop runs the test.
// SRS: REQ-6 – REQ-10. Owner: Huzaifah (WP-08).
import mongoose from 'mongoose';
import request from 'supertest';
import { vi } from 'vitest';
import app from '../app.js';
import { settings } from '../config/settings.js';
import CatalogModel from '../models/CatalogModel.js';
import DeviceProfile from '../models/DeviceProfile.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { checkInstalled } from '../worker/llamacpp.js';
import {
  checkActiveJobs,
  checkDisk,
  checkLevels,
  checkLicence,
  checkModel,
  checkProfile,
  checkRam,
  checkTool,
  checkToken,
  estimateDiskNeedMb,
} from '../services/preflightService.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

vi.mock('../utils/systemInfo.js', () => ({ getFreeDiskMb: vi.fn(async () => 500_000) }));
vi.mock('../worker/llamacpp.js', () => ({ checkInstalled: vi.fn(() => 'b12376') }));

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const saved = { ...settings };
afterEach(() => Object.assign(settings, saved)); // undo settings changed by a test

const smol = {
  hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
  revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
  displayName: 'SmolLM2 135M Instruct',
  paramsBillion: 0.135,
  license: 'Apache-2.0',
  f16SizeMb: 259,
};

describe('the individual checks', () => {
  it('model: missing → E-CAT-01, found → passes with the pinned revision', () => {
    expect(checkModel(null)).toMatchObject({ passed: false, code: 'E-CAT-01' });
    expect(checkModel(smol).message).toContain('12fd25f');
  });

  it('levels: only Q5_K_M, Q4_K_M, Q8_0, at least one', () => {
    expect(checkLevels(['Q4_K_M', 'Q5_K_M']).passed).toBe(true);
    for (const bad of [[], ['F16'], ['Q2_K'], undefined]) {
      expect(checkLevels(bad)).toMatchObject({ passed: false, code: 'E-LVL-01' });
    }
  });

  it('profile: must exist', () => {
    expect(checkProfile(null).passed).toBe(false);
    expect(checkProfile({ name: 'My laptop' }).passed).toBe(true);
  });

  it('disk: needs 3 × F16 + quantized files + 2 GB reserve', () => {
    // 1000 MB F16 with Q4_K_M (4.9 bits → 306.25 MB): 3000 + 306.25 + 2048 = 5354.25 → 5355
    expect(estimateDiskNeedMb(1000, ['Q4_K_M'])).toBe(5355);
    expect(checkDisk(5355, 5355).passed).toBe(true);
    expect(checkDisk(5355, 1024)).toMatchObject({ passed: false, code: 'E-DISK-01' });
    expect(checkDisk(5355, 1024).message).toMatch(/Needs 5\.2 GB free, only 1\.0 GB free/);
  });

  it('RAM: needs 1.2 × F16', () => {
    expect(checkRam(1000, 1200).passed).toBe(true);
    expect(checkRam(1000, 1199)).toMatchObject({ passed: false, code: 'E-RAM-01' });
  });

  it('licence: must be accepted', () => {
    expect(checkLicence(smol, false)).toMatchObject({ passed: false, code: 'E-LIC-01' });
    expect(checkLicence(smol, true).passed).toBe(true);
  });

  it('token: a gated model needs HF_TOKEN', () => {
    settings.hfToken = '';
    expect(checkToken({ gated: true })).toMatchObject({ passed: false, code: 'E-HF-01' });
    expect(checkToken({ gated: false }).passed).toBe(true);
    settings.hfToken = 'hf_test';
    expect(checkToken({ gated: true }).passed).toBe(true);
  });

  it('llama.cpp: found → passes, missing → E-TOOL-01, fake pipeline → skipped', () => {
    settings.fakePipeline = false;
    expect(checkTool().passed).toBe(true);

    checkInstalled.mockImplementationOnce(() => {
      throw Object.assign(new Error('llama.cpp b12376 not found'), {
        code: 'E-TOOL-01',
        hint: 'x',
      });
    });
    expect(checkTool()).toMatchObject({ passed: false, code: 'E-TOOL-01' });

    settings.fakePipeline = true;
    expect(checkTool()).toMatchObject({ passed: true, message: expect.stringMatching(/Skipped/) });
  });

  it('active jobs: fewer than 2', () => {
    expect(checkActiveJobs(1).passed).toBe(true);
    expect(checkActiveJobs(2)).toMatchObject({ passed: false, code: 'E-LIMIT-01' });
  });
});

describe('POST /api/jobs/preflight', () => {
  async function setup() {
    const model = await CatalogModel.create(smol);
    const { body: profile } = await request(app)
      .post('/api/profiles')
      .send({ name: 'My laptop', ramMb: 16384, freeDiskMb: 100000, cpuThreads: 8 });
    return { modelId: model._id, profileId: profile._id };
  }

  it('passes when everything is fine', async () => {
    const ids = await setup();

    const res = await request(app)
      .post('/api/jobs/preflight')
      .send({ ...ids, levels: ['Q5_K_M', 'Q4_K_M'], licenseAccepted: true });

    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.checks.map((c) => c.id)).toEqual([
      'model', 'levels', 'profile', 'disk', 'ram', 'licence', 'token', 'tool', 'jobs',
    ]); // prettier-ignore
  });

  it('lists every failing check at once', async () => {
    const ids = await setup();

    const res = await request(app)
      .post('/api/jobs/preflight')
      .send({ ...ids, levels: ['F16'], licenseAccepted: false });

    expect(res.body.passed).toBe(false);
    const failed = res.body.checks.filter((c) => !c.passed).map((c) => c.code);
    expect(failed).toEqual(['E-LVL-01', 'E-LIC-01']);
  });

  it('fails E-CAT-01 for an unknown or malformed model id', async () => {
    const { profileId } = await setup();

    for (const modelId of [new mongoose.Types.ObjectId(), 'abc']) {
      const res = await request(app)
        .post('/api/jobs/preflight')
        .send({ modelId, profileId, levels: ['Q4_K_M'], licenseAccepted: true });
      expect(res.body.checks[0]).toMatchObject({ id: 'model', passed: false, code: 'E-CAT-01' });
    }
  });

  it("doesn't accept another user's device profile", async () => {
    const { modelId } = await setup();
    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });
    const theirs = await DeviceProfile.create({
      user: other._id,
      name: 'Theirs',
      ramMb: 8192,
      freeDiskMb: 1000,
      cpuThreads: 4,
    });

    const res = await request(app)
      .post('/api/jobs/preflight')
      .send({ modelId, profileId: theirs._id, levels: ['Q4_K_M'], licenseAccepted: true });

    expect(res.body.checks.find((c) => c.id === 'profile').passed).toBe(false);
  });

  it('blocks a third job while two are active (E-LIMIT-01)', async () => {
    const ids = await setup();
    const demo = await User.findOne({ email: settings.demoUserEmail });
    const base = {
      user: demo._id,
      model: ids.modelId,
      profile: ids.profileId,
      quantLevels: ['Q4_K_M'],
    };
    await Job.create([
      { ...base },
      { ...base, status: 'QUANTIZING' },
      { ...base, status: 'COMPLETED' },
    ]);

    const res = await request(app)
      .post('/api/jobs/preflight')
      .send({ ...ids, levels: ['Q4_K_M'], licenseAccepted: true });

    expect(res.body.checks.find((c) => c.id === 'jobs')).toMatchObject({ code: 'E-LIMIT-01' });
  });
});
