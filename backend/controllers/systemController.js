// systemController.js — answers questions about the server itself.
// SRS: REQ-4, REQ-21, Section 3. Owner: Huzaifah.
import fs from 'node:fs';
import { settings, ROOT_DIR } from '../config/settings.js';
import { isDBConnected } from '../config/db.js';
import { getHostProfile } from '../utils/systemInfo.js';

// GET /api/system/health — public. Is the API up, is the database reachable, which
// llama.cpp build and mode is this server using?
export function getHealth(req, res) {
  res.json({
    status: 'ok',
    database: isDBConnected() ? 'connected' : 'disconnected',
    llamaCppRef: settings.llamaCppRef,
    demoMode: settings.demoMode,
  });
}

// GET /api/system/host-profile — this server's RAM, free disk and threads.
export async function getHostProfileHandler(req, res, next) {
  try {
    // Measure the disk that will hold the model files (data/ may not exist yet).
    const folder = fs.existsSync(settings.dataDir) ? settings.dataDir : ROOT_DIR;
    res.json(await getHostProfile(folder));
  } catch (err) {
    next(err);
  }
}
