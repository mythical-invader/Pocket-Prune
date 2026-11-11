// catalog.test.js — GET /api/catalog and /api/catalog/:id, plus the seed data rules.
// SRS: REQ-1, REQ-2, REQ-3. Owner: Huzaifah.
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import CatalogModel from '../models/CatalogModel.js';
import { CATALOG_SEED } from '../seedData.js';
import { checkCatalogEntry } from '../services/catalogService.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const model = (overrides) => ({
  hfRepoId: 'Org/Model',
  revision: 'a'.repeat(40),
  displayName: 'Model',
  paramsBillion: 1,
  license: 'Apache-2.0',
  f16SizeMb: 2000,
  ...overrides,
});

describe('GET /api/catalog', () => {
  it('lists active models, demo models first, then smallest first', async () => {
    await CatalogModel.create([
      model({ hfRepoId: 'Org/Big', paramsBillion: 1.5 }),
      model({ hfRepoId: 'Org/Small', paramsBillion: 0.5 }),
      model({ hfRepoId: 'Org/Demo', paramsBillion: 0.9, isDemo: true }),
      model({ hfRepoId: 'Org/Off', paramsBillion: 0.1, isActive: false }),
    ]);

    const res = await request(app).get('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.hfRepoId)).toEqual(['Org/Demo', 'Org/Small', 'Org/Big']);
  });

  it('returns each model with its pinned revision and sizes', async () => {
    await CatalogModel.create(model());

    const [first] = (await request(app).get('/api/catalog')).body;

    expect(first).toMatchObject({ revision: 'a'.repeat(40), paramsBillion: 1, f16SizeMb: 2000 });
  });
});

describe('GET /api/catalog/:id', () => {
  it('returns one active model', async () => {
    const created = await CatalogModel.create(model());

    const res = await request(app).get(`/api/catalog/${created._id}`);

    expect(res.status).toBe(200);
    expect(res.body.hfRepoId).toBe('Org/Model');
  });

  it('answers E-CAT-01 for an unknown, inactive or malformed id', async () => {
    const off = await CatalogModel.create(model({ isActive: false }));
    const ids = [new mongoose.Types.ObjectId(), off._id, 'not-an-id'];

    for (const id of ids) {
      const res = await request(app).get(`/api/catalog/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('E-CAT-01');
    }
  });
});

describe('catalog seed data', () => {
  it('every seeded model passes the catalog rules (pinned hash, ≤ 4 B parameters)', () => {
    for (const entry of CATALOG_SEED) {
      expect(checkCatalogEntry(entry), entry.hfRepoId).toEqual([]);
    }
  });

  it('has the three demo models and no duplicate repos', () => {
    const repos = CATALOG_SEED.map((m) => m.hfRepoId);
    expect(new Set(repos).size).toBe(repos.length);
    expect(CATALOG_SEED.filter((m) => m.isDemo)).toHaveLength(3);
  });

  it('rejects a model over the 4 B limit and a revision that is not a commit hash', () => {
    expect(checkCatalogEntry(model({ paramsBillion: 7 })).join(' ')).toMatch(/limit/);
    expect(checkCatalogEntry(model({ revision: 'main' })).join(' ')).toMatch(/commit hash/);
  });
});
