// downloader.js — downloads one catalog model from Hugging Face with the `hf` tool.
// Only safetensors weights + tokenizer + config, at the pinned revision (never .bin files).
// If the same revision is already on disk it is reused instead of downloaded again.
// SRS: REQ-2 (pinned revision), REQ-11 (safetensors only, resume). Owner: Sibghatullah (WP-04).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { runCommand } from '../utils/runCommand.js';
import { appError } from '../utils/errors.js';

const MARKER = '.pocketprune-revision'; // written after a complete download

export function hfPath() {
  const venv = path.join(settings.llamaCppDir, 'venv');
  return process.platform === 'win32'
    ? path.join(venv, 'Scripts', 'hf.exe')
    : path.join(venv, 'bin', 'hf');
}

// data/models/HuggingFaceTB__SmolLM2-135M-Instruct  ('/' is not allowed in a folder name)
export function modelDir(hfRepoId) {
  return path.join(settings.dataDir, 'models', hfRepoId.replace('/', '__'));
}

export async function downloadModel(hfRepoId, revision, { onLine } = {}) {
  const dir = modelDir(hfRepoId);
  const marker = path.join(dir, MARKER);
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === revision) {
    return { dir, reused: true, durationSec: 0 };
  }

  const args = [
    'download', hfRepoId,
    '--revision', revision,
    '--include', '*.safetensors', '*.json', 'tokenizer*',
    '--local-dir', dir,
  ]; // prettier-ignore
  const env = {
    // The token goes in the environment, not the arguments, so it never appears in a log line.
    ...(settings.hfToken ? { HF_TOKEN: settings.hfToken } : {}),
    HF_HOME: path.join(settings.dataDir, 'hf-cache'), // keep Hugging Face's cache next to our data
    HF_HUB_DISABLE_PROGRESS_BARS: '1', // progress bars would flood the job log
  };

  const result = await runCommand(hfPath(), args, {
    env,
    onLine,
    timeoutMs: settings.timeoutsMin.download * 60_000,
  });
  if (result.code !== 0) {
    // 401/403 = the model is gated and we have no (valid) token.
    const text = result.lines.join('\n');
    if (/\b(401|403)\b|gated|restricted/i.test(text)) throw appError('E-HF-01');
    throw appError('E-HF-02');
  }
  if (!fs.readdirSync(dir).some((f) => f.endsWith('.safetensors'))) {
    throw appError('E-HF-02', { message: 'Download finished but no .safetensors file was found.' });
  }

  fs.writeFileSync(marker, revision);
  return { dir, reused: false, durationSec: result.durationSec };
}
