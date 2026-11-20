// artifactFiles.js — is a job's file really on THIS server's disk, and safe to send?
// Files live on the machine that ran the job (data/artifacts/<jobId>/). With the shared Atlas
// database a job may have run on the other laptop, so its files are there, not here.
// Used by the Downloads API and the Results API. SRS: REQ-30. Owner: Huzaifah (WP-17).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';

// Safety: only files inside data/artifacts, whatever path is stored in the database.
export function isInsideArtifacts(filePath) {
  const root = path.resolve(settings.dataDir, 'artifacts');
  return path.resolve(filePath).startsWith(root + path.sep);
}

export function onThisServer(filePath) {
  return Boolean(filePath) && isInsideArtifacts(filePath) && fs.existsSync(filePath);
}
