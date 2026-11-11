// profiles.test.js — create, list, read, update and delete device profiles, with validation
// and "own data only". SRS: REQ-4, REQ-32. Owner: Huzaifah.
import request from 'supertest';
import app from '../app.js';
import DeviceProfile from '../models/DeviceProfile.js';
import User from '../models/User.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const laptop = { name: 'My laptop', ramMb: 16384, freeDiskMb: 102400, cpuThreads: 8 };

describe('POST /api/profiles', () => {
  it('creates a profile for the current user (default preference "balanced")', async () => {
    const res = await request(app).post('/api/profiles').send(laptop);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...laptop, preference: 'balanced' });
    const demo = await User.findOne({ email: 'demo@pocketprune.local' });
    expect(res.body.user).toBe(String(demo._id));
  });

  it('rejects missing or invalid values with E-INPUT-01 and the field names', async () => {
    const res = await request(app)
      .post('/api/profiles')
      .send({ name: '', ramMb: 100, cpuThreads: 0, preference: 'fastest' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('E-INPUT-01');
    expect(Object.keys(res.body.details)).toEqual(
      expect.arrayContaining(['name', 'ramMb', 'freeDiskMb', 'cpuThreads', 'preference'])
    );
  });

  it('ignores a "user" field in the body (cannot create profiles for someone else)', async () => {
    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });

    const res = await request(app)
      .post('/api/profiles')
      .send({ ...laptop, user: other._id });

    expect(res.body.user).not.toBe(String(other._id));
  });
});

describe('GET, PUT and DELETE /api/profiles', () => {
  it('lists, reads, updates and deletes the user’s own profile', async () => {
    const { body: created } = await request(app).post('/api/profiles').send(laptop);

    const list = await request(app).get('/api/profiles');
    expect(list.body).toHaveLength(1);

    const one = await request(app).get(`/api/profiles/${created._id}`);
    expect(one.body.name).toBe('My laptop');

    const updated = await request(app)
      .put(`/api/profiles/${created._id}`)
      .send({ ...laptop, preference: 'speed' });
    expect(updated.status).toBe(200);
    expect(updated.body.preference).toBe('speed');

    const removed = await request(app).delete(`/api/profiles/${created._id}`);
    expect(removed.body).toEqual({ deleted: true });
    expect(await DeviceProfile.countDocuments()).toBe(0);
  });

  it('validates updates too', async () => {
    const { body: created } = await request(app).post('/api/profiles').send(laptop);

    const res = await request(app)
      .put(`/api/profiles/${created._id}`)
      .send({ ...laptop, cpuThreads: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('E-INPUT-01');
  });

  it("treats another user's profile as not found (read, update, delete)", async () => {
    const other = await User.create({ email: 'other@example.com', passwordHash: 'x' });
    const theirs = await DeviceProfile.create({ ...laptop, user: other._id });
    const url = `/api/profiles/${theirs._id}`;

    expect((await request(app).get(url)).status).toBe(404);
    expect((await request(app).put(url).send(laptop)).status).toBe(404);
    expect((await request(app).delete(url)).status).toBe(404);
    expect((await request(app).get('/api/profiles')).body).toEqual([]);
    expect(await DeviceProfile.countDocuments()).toBe(1); // still there
  });
});
