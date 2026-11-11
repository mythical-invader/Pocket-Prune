// system.test.js — health, host profile and the temporary demo-user `protect`.
// SRS: REQ-4, REQ-21. Owner: Huzaifah.
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

describe('GET /api/system/health', () => {
  it('reports the API, database and llama.cpp settings', async () => {
    const res = await request(app).get('/api/system/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
    expect(res.body).toHaveProperty('llamaCppRef');
    expect(typeof res.body.demoMode).toBe('boolean');
  });
});

describe('GET /api/system/host-profile', () => {
  it("returns this computer's RAM, disk and threads as positive numbers", async () => {
    const res = await request(app).get('/api/system/host-profile');

    expect(res.status).toBe(200);
    for (const key of ['ramMb', 'freeRamMb', 'freeDiskMb', 'cpuThreads']) {
      expect(res.body[key]).toBeGreaterThan(0);
    }
    expect(typeof res.body.machineName).toBe('string');
  });

  it('acts as the demo user, created once and reused', async () => {
    await request(app).get('/api/system/host-profile');
    await request(app).get('/api/system/host-profile');

    const users = await User.find();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('demo@pocketprune.local');
  });
});
