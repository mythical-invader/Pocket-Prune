// models.test.js — the Mongoose schemas accept good data and reject bad data.
// SRS: REQ-4, REQ-6. Owner: Huzaifah.
import mongoose from 'mongoose';
import User from '../models/User.js';
import CatalogModel from '../models/CatalogModel.js';
import DeviceProfile from '../models/DeviceProfile.js';
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const id = () => new mongoose.Types.ObjectId();

describe('User', () => {
  it('stores the email in lower case and never shows the password hash', async () => {
    const user = await User.create({ email: 'Huzaifah@Example.com', passwordHash: 'x' });

    expect(user.email).toBe('huzaifah@example.com');
    expect(user.role).toBe('user');
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
  });
});

describe('CatalogModel', () => {
  it('saves a model with sensible defaults', async () => {
    const model = await CatalogModel.create({
      hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
      revision: 'abc123',
      displayName: 'SmolLM2 135M',
      paramsBillion: 0.135,
      license: 'apache-2.0',
    });

    expect(model.isActive).toBe(true);
    expect(model.gated).toBe(false);
  });
});

describe('DeviceProfile', () => {
  it('rejects an unknown preference', async () => {
    const profile = new DeviceProfile({
      user: id(),
      name: 'Laptop',
      ramMb: 8192,
      freeDiskMb: 20000,
      cpuThreads: 8,
      preference: 'fastest',
    });

    await expect(profile.validate()).rejects.toThrow(/preference/);
  });
});

describe('Job', () => {
  const base = () => ({ user: id(), model: id(), profile: id(), quantLevels: ['Q4_K_M'] });

  it('starts QUEUED at 0 % and is not fake', async () => {
    const job = await Job.create(base());

    expect(job.status).toBe('QUEUED');
    expect(job.progressPct).toBe(0);
    expect(job.cancelRequested).toBe(false);
    expect(job.fake).toBe(false);
  });

  it('needs at least one level', async () => {
    await expect(Job.create({ ...base(), quantLevels: [] })).rejects.toThrow(/at least one level/);
  });

  it('only accepts known levels (F16 is always made, so it cannot be requested)', async () => {
    await expect(Job.create({ ...base(), quantLevels: ['F16'] })).rejects.toThrow();
    await expect(Job.create({ ...base(), quantLevels: ['Q2_K'] })).rejects.toThrow();
  });

  it('stores variants with metrics and a recommendation', async () => {
    const job = await Job.create({
      ...base(),
      variants: [
        { level: 'Q4_K_M', fileSizeMb: 105, metrics: { tpsGen: 120.5, perplexity: 21.3 } },
      ],
      recommendation: { chosenLevel: 'Q4_K_M', ruleFired: 'balanced' },
    });

    expect(job.variants[0].metrics.tpsGen).toBe(120.5);
    expect(job.recommendation.qualityRisk).toBe(false);
  });
});

describe('JobEvent', () => {
  it('defaults to level "info"', async () => {
    const event = await JobEvent.create({ job: id(), stage: 'QUEUED', message: 'Job created' });
    expect(event.level).toBe('info');
  });
});
