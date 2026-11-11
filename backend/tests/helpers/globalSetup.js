// globalSetup.js — starts ONE in-memory MongoDB before all test files and stops it after.
// (Starting one per file in parallel sometimes hung on Windows.) Each test file then uses
// its own database on this server — see testDb.js. Owner: Huzaifah.
import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function setup(project) {
  const server = await MongoMemoryServer.create();
  project.provide('mongoUri', server.getUri()); // read in tests with inject('mongoUri')
  return () => server.stop();
}
