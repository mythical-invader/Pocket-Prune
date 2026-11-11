// errors.test.js — every error leaves the API as { code, message, hint }.
// Owner: Huzaifah.
import request from 'supertest';
import app from '../app.js';
import { appError, ERRORS } from '../utils/errors.js';
import { errorHandler } from '../middleware/errorHandler.js';

// A tiny fake `res` that remembers what the handler sent.
function fakeRes() {
  const res = {};
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
}

describe('appError', () => {
  it('fills message, hint and status from the code table', () => {
    const err = appError('E-DISK-01');

    expect(err.code).toBe('E-DISK-01');
    expect(err.status).toBe(409);
    expect(err.message).toBe('Not enough free disk space.');
    expect(err.hint).toBeTruthy();
  });

  it('lets the caller give a more specific hint', () => {
    const err = appError('E-DISK-01', { hint: 'Free 4 GB or choose fewer levels.' });
    expect(err.hint).toBe('Free 4 GB or choose fewer levels.');
  });

  it('has a message and hint for every code', () => {
    for (const [code, [status, message, hint]] of Object.entries(ERRORS)) {
      expect(code).toMatch(/^E-[A-Z]+-\d\d$/);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(message && hint).toBeTruthy();
    }
  });
});

describe('errorHandler', () => {
  it('sends our own errors unchanged', () => {
    const res = fakeRes();
    errorHandler(appError('E-LIMIT-01'), {}, res, () => {});

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      code: 'E-LIMIT-01',
      message: 'Too many active jobs.',
      hint: 'Wait for a running job to finish.',
    });
  });

  it('hides unexpected errors behind E-SERVER-01', () => {
    const res = fakeRes();
    errorHandler(new Error('secret stack detail'), {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('E-SERVER-01');
    expect(res.body.message).not.toContain('secret');
  });

  it('turns a Mongoose validation error into E-INPUT-01 with field details', () => {
    const res = fakeRes();
    const err = { name: 'ValidationError', errors: { ramMb: { message: 'ramMb is required' } } };
    errorHandler(err, {}, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('E-INPUT-01');
    expect(res.body.details).toEqual({ ramMb: 'ramMb is required' });
  });
});

describe('unknown routes and bad JSON', () => {
  it('answers an unknown /api address with E-NOTFOUND-01', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('E-NOTFOUND-01');
  });

  it('answers a broken JSON body with E-INPUT-01', async () => {
    const res = await request(app)
      .post('/api/does-not-exist')
      .set('Content-Type', 'application/json')
      .send('{ not json');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('E-INPUT-01');
  });
});
