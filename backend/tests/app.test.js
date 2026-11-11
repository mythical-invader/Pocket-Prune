// app.test.js — first test: the API skeleton answers. Shows the pattern later tests follow
// (import the app, call it with supertest, check status and body). Owner: Huzaifah.
import request from 'supertest';
import app from '../app.js';

describe('API skeleton', () => {
  it('GET /api answers with the API name', async () => {
    const res = await request(app).get('/api');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'PocketPrune API', status: 'ok' });
  });
});
