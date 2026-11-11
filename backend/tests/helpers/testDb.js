// testDb.js — gives each test file its own throw-away database on the in-memory MongoDB
// started by globalSetup.js, so tests never touch the shared Atlas database.
// Owner: Huzaifah.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';

export async function startTestDb() {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${crypto.randomUUID()}` });
}

export async function clearTestDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function stopTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
