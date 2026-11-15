// globalSetup.js — starts ONE in-memory MongoDB before all test files and stops it after.
// (Starting one per file in parallel sometimes hung on Windows.) Each test file then uses
// its own database on this server — see testDb.js. Owner: Huzaifah.
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Keep the downloaded MongoDB test program (~80 MB) inside the repo's node_modules/.cache.
// Without this, starting tests from backend/ falls back to the home folder (C: on Windows).
process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'node_modules',
  '.cache',
  'mongodb-memory-server'
);

export default async function setup(project) {
  const server = await MongoMemoryServer.create();
  project.provide('mongoUri', server.getUri()); // read in tests with inject('mongoUri')
  return () => server.stop();
}
