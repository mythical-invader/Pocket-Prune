// app.js — builds the Express app (routes + middleware) without starting it.
// Kept separate from server.js so tests can call the app directly with supertest.
// SRS: Section 3 (software interfaces – REST API). Owner: Huzaifah.
import express from 'express';
import morgan from 'morgan';
import systemRoutes from './routes/systemRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
// Log each request in the terminal ("GET /api 200 3 ms"), but not while tests run.
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api', (req, res) => {
  res.json({ name: 'PocketPrune API', status: 'ok' });
});
app.use('/api/system', systemRoutes);

// These two must stay last: unknown /api addresses, then the shared error format.
app.use('/api', notFound);
app.use(errorHandler);

export default app;
