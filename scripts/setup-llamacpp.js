// setup-llamacpp.js — installs ONE pinned llama.cpp release and a Python venv for its converter.
// Windows: downloads the ready-made CPU build. Linux/macOS: builds the same tag from source.
// Run with: npm run setup:llamacpp   (safe to run again — it skips work that is already done)
// Reads LLAMA_CPP_DIR and LLAMA_CPP_REF from .env. SRS: REQ-9, REQ-12. Owner: Sibghatullah (WP-02).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.join(import.meta.dirname, '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // No .env yet: the defaults below are used.
}

const TAG = process.env.LLAMA_CPP_REF || 'b12376';
const DIR = path.resolve(process.env.LLAMA_CPP_DIR || path.join(os.homedir(), 'llama.cpp'));
const isWindows = process.platform === 'win32';
const RELEASES = 'https://github.com/ggml-org/llama.cpp';

const srcDir = path.join(DIR, 'src'); // source at TAG: convert_hf_to_gguf.py + gguf-py
const binDir = path.join(DIR, 'bin'); // llama-quantize, llama-cli, llama-bench, …
const venvDir = path.join(DIR, 'venv'); // Python only for the converter and `hf download`
const venvPython = isWindows
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

// Run a program and stop the script if it fails. Arguments are an array, never one string.
function run(cmd, args, cwd = DIR) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${cmd} failed (exit ${result.status})`);
}

async function download(url, file) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// Windows' own tar.exe can unpack .zip and .tar.gz; Git Bash's tar cannot unpack .zip.
const tar = isWindows ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';

async function main() {
  const versionFile = path.join(DIR, 'VERSION');
  if (fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8').trim() === TAG) {
    console.log(`llama.cpp ${TAG} is already installed in ${DIR}`);
    return;
  }
  fs.mkdirSync(DIR, { recursive: true });

  // 1. Source code at the pinned tag (needed on every OS for the Python converter).
  const srcArchive = path.join(DIR, `${TAG}-src.tar.gz`);
  await download(`${RELEASES}/archive/refs/tags/${TAG}.tar.gz`, srcArchive);
  fs.rmSync(srcDir, { recursive: true, force: true });
  fs.mkdirSync(srcDir);
  run(tar, ['-xzf', srcArchive, '-C', srcDir, '--strip-components=1']);

  // 2. The programs: ready-made on Windows, compiled with CMake elsewhere (CPU only).
  fs.rmSync(binDir, { recursive: true, force: true });
  fs.mkdirSync(binDir);
  if (isWindows) {
    const zip = path.join(DIR, `${TAG}-win-cpu-x64.zip`);
    await download(`${RELEASES}/releases/download/${TAG}/llama-${TAG}-bin-win-cpu-x64.zip`, zip);
    run(tar, ['-xf', zip, '-C', binDir]);
  } else {
    run('cmake', ['-B', 'build', '-DGGML_CUDA=OFF', '-DLLAMA_CURL=OFF'], srcDir);
    run('cmake', ['--build', 'build', '--config', 'Release', '-j'], srcDir);
    fs.cpSync(path.join(srcDir, 'build', 'bin'), binDir, { recursive: true });
  }

  // 3. Python venv with the converter's requirements and the `hf` download tool.
  if (!fs.existsSync(venvPython)) {
    if (isWindows) run('py', ['-3.12', '-m', 'venv', venvDir]);
    else run('python3', ['-m', 'venv', venvDir]);
  }
  run(venvPython, ['-m', 'pip', 'install', '--no-cache-dir', '--upgrade', 'pip']);
  const requirements = path.join(srcDir, 'requirements', 'requirements-convert_hf_to_gguf.txt');
  run(venvPython, ['-m', 'pip', 'install', '--no-cache-dir', '-r', requirements]);
  run(venvPython, ['-m', 'pip', 'install', '--no-cache-dir', 'huggingface_hub[cli]']);

  // 4. Check the build answers, then remember which tag is installed.
  run(path.join(binDir, isWindows ? 'llama-cli.exe' : 'llama-cli'), ['--version']);
  fs.writeFileSync(versionFile, TAG);
  fs.rmSync(srcArchive, { force: true });
  fs.rmSync(path.join(DIR, `${TAG}-win-cpu-x64.zip`), { force: true });
  console.log(`\nDone: llama.cpp ${TAG} in ${DIR}`);
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
});
