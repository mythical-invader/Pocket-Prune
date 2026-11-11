// server.js — entry point of the API: loads settings from the root .env and starts listening.
// SRS: Section 3 (software interfaces – REST API). Owner: Huzaifah.
import path from 'node:path';
import dotenv from 'dotenv';

// One .env file in the repo root is shared by the API, the worker and the scripts.
dotenv.config({ path: path.join(import.meta.dirname, '..', '.env'), quiet: true });

// Import the app after dotenv so every file sees the settings.
const { default: app } = await import('./app.js');

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`PocketPrune API running on http://localhost:${port}/api`);
});
