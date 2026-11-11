// errorHandler.js — turns every error into the same JSON shape:
//   { "code": "E-DISK-01", "message": "Not enough free disk space.", "hint": "…" }
// so the website can always show what failed, why, and how to fix it.
// SRS: Section 3 (error messages). Owner: Huzaifah.
import { appError } from '../utils/errors.js';

// Any /api address that no route answered.
export function notFound(req, res, next) {
  next(
    appError('E-NOTFOUND-01', { message: `No API route for ${req.method} ${req.originalUrl}.` })
  );
}

// Express recognises an error handler by its 4 arguments.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  // Mongoose: a field failed its schema rules → list the fields.
  if (err.name === 'ValidationError') {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message])
    );
    error = appError('E-INPUT-01', { details });
  }
  // Mongoose: an id that isn't a valid ObjectId, e.g. /api/jobs/abc.
  else if (err.name === 'CastError') {
    error = appError('E-NOTFOUND-01');
  }
  // MongoDB: a unique field (e.g. email, hfRepoId) already exists.
  else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    error = appError('E-INPUT-01', { message: `This ${field} already exists.` });
  }
  // Body that isn't valid JSON.
  else if (err.type === 'entity.parse.failed') {
    error = appError('E-INPUT-01', { message: 'The request body is not valid JSON.' });
  }
  // Anything we didn't throw on purpose is a bug: log it, but don't leak details.
  else if (!err.code || !err.status) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    error = appError('E-SERVER-01');
  }

  const body = { code: error.code, message: error.message, hint: error.hint };
  if (error.details) body.details = error.details;
  res.status(error.status).json(body);
}
