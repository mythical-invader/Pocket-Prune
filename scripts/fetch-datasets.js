// fetch-datasets.js — downloads the two FIXED test files that quality is measured on, into the
// data folder, and checks each SHA-256 so every machine measures on exactly the same text:
//   - WikiText-2 test text  → data/wikitext/wiki.test.raw          (perplexity, WP-09 / WP-16)
//   - HellaSwag validation  → data/hellaswag/hellaswag_val_full.txt (task accuracy, E2, WP-16)
// Sources: the copies llama.cpp's own scripts use (scripts/get-wikitext-2.sh, get-hellaswag.sh).
// The expected SHA-256 values live in backend/worker/evaluator.js (DATASETS) — one source of truth.
// Run with: npm run fetch:datasets   (safe to run again; `npm run fetch:wikitext` is the old name).
// SRS: REQ-18, REQ-21. Owner: Sibghatullah (WP-09, HellaSwag WP-16).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { settings } from '../backend/config/settings.js';
import { sha256File } from '../backend/utils/fileHash.js';
import { DATASETS } from '../backend/worker/evaluator.js';

const SOURCES = {
  wikitext: {
    url: 'https://huggingface.co/datasets/ggml-org/ci/resolve/main/wikitext-2-raw-v1.zip',
    zipEntry: path.join('wikitext-2-raw', 'wiki.test.raw'), // the file we need inside the zip
  },
  hellaswag: {
    url: 'https://raw.githubusercontent.com/klosax/hellaswag_text_data/main/hellaswag_val_full.txt',
  },
};

async function download(url, target) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
}

// Unzip with the system's own tool: Windows' tar.exe reads .zip files; Linux/macOS use unzip.
function unzip(zip, dir) {
  const result =
    process.platform === 'win32'
      ? spawnSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-xf', zip, '-C', dir])
      : spawnSync('unzip', ['-o', zip, '-d', dir]);
  if (result.status !== 0) throw new Error(`Could not unzip ${zip}`);
}

async function fetchDataset(key) {
  const dataset = DATASETS[key];
  const source = SOURCES[key];
  const target = path.join(settings.dataDir, dataset.file);
  const dir = path.dirname(target);

  if (fs.existsSync(target) && (await sha256File(target)) === dataset.sha256) {
    console.log(`✔ ${dataset.name} already present and verified: ${target}`);
    return true;
  }

  fs.mkdirSync(dir, { recursive: true });
  if (source.zipEntry) {
    const zip = path.join(dir, 'download.zip');
    await download(source.url, zip);
    unzip(zip, dir);
    fs.copyFileSync(path.join(dir, source.zipEntry), target);
    fs.rmSync(zip, { force: true });
    fs.rmSync(path.join(dir, source.zipEntry.split(path.sep)[0]), { recursive: true, force: true });
  } else {
    await download(source.url, target);
  }

  const sha = await sha256File(target);
  if (sha !== dataset.sha256) {
    console.error(
      `✖ ${dataset.name}: SHA-256 mismatch!\n  expected ${dataset.sha256}\n  got      ${sha}`
    );
    return false;
  }
  console.log(`✔ ${dataset.name} ready and verified: ${target}`);
  return true;
}

let ok = true;
for (const key of Object.keys(DATASETS)) ok = (await fetchDataset(key)) && ok;
process.exitCode = ok ? 0 : 1;
