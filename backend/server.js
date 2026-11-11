// server.js — entry point of the API: connects to MongoDB, then starts listening.
// SRS: Section 3 (software interfaces – REST API). Owner: Huzaifah.
import { settings } from './config/settings.js';
import { connectDB } from './config/db.js';
import app from './app.js';

try {
  await connectDB(settings.mongoUri);
} catch (err) {
  console.error(`Could not connect to MongoDB (${err.message}).`);
  console.error('Check MONGO_URI in the root .env file — see README "Install".');
  process.exit(1);
}

app.listen(settings.port, () => {
  console.log(`PocketPrune API running on http://localhost:${settings.port}/api`);
});
