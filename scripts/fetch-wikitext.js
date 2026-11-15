// fetch-wikitext.js — downloads the WikiText-2 test text that perplexity is measured on, into
// data/wikitext/wiki.test.raw, and checks its SHA-256 so every machine measures on the SAME text.
// Source: the copy llama.cpp's own scripts use (huggingface.co/datasets/ggml-org/ci).
// Run with: npm run fetch:wikitext   (safe to run again). SRS: REQ-18, REQ-21. Owner: Sibghatullah (WP-09).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { settings } from '../backend/config/settings.js';
import { sha256File } from '../backend/utils/fileHash.js';

const URL = 'https://huggingface.co/datasets/ggml-org/ci/resolve/main/wikitext-2-raw-v1.zip';
// Measured in WP-02. If this ever changes, perplexity results are no longer comparable.
const EXPECTED_SHA256 = '173c87a53759e0201f33e0ccf978e510c2042d7f2cb78229d9a50d79b9e7dd08';

const dir = path.join(settings.dataDir, 'wikitext');
const target = path.join(dir, 'wiki.test.raw');

if (fs.existsSync(target) && (await sha256File(target)) === EXPECTED_SHA256) {
  console.log(`WikiText-2 already present and verified: ${target}`);
  process.exit(0);
}

fs.mkdirSync(dir, { recursive: true });
const zip = path.join(dir, 'wikitext-2-raw-v1.zip');
console.log(`Downloading ${URL}`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));

// Unzip: Windows' own tar.exe can read .zip files; on Linux/macOS use unzip.
const isWindows = process.platform === 'win32';
const unzip = isWindows
  ? spawnSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-xf', zip, '-C', dir])
  : spawnSync('unzip', ['-o', zip, '-d', dir]);
if (unzip.status !== 0) throw new Error(`Could not unzip ${zip}`);

fs.copyFileSync(path.join(dir, 'wikitext-2-raw', 'wiki.test.raw'), target);
fs.rmSync(zip, { force: true });
fs.rmSync(path.join(dir, 'wikitext-2-raw'), { recursive: true, force: true });

const sha = await sha256File(target);
if (sha !== EXPECTED_SHA256) {
  console.error(`SHA-256 mismatch!\n  expected ${EXPECTED_SHA256}\n  got      ${sha}`);
  process.exit(1);
}
console.log(`WikiText-2 ready and verified: ${target}`);
