// app.js — builds the Express app (routes + middleware) without starting it.
// Kept separate from server.js so tests can call the app directly with supertest.
// SRS: Section 3 (software interfaces – REST API). Owner: Huzaifah.
import express from 'express';
import morgan from 'morgan';

const app = express();

app.use(express.json());
// Log each request in the terminal ("GET /api 200 3 ms"), but not while tests run.
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Skeleton route: proves the API is up. WP-03 adds /api/system/health and the real routes.
app.get('/api', (req, res) => {
  res.json({ name: 'PocketPrune API', status: 'ok' });
});

export default app;
