// llamacpp.js — the ONLY file that knows how llama.cpp commands look (the "LlamaCppAdapter").
// Each function builds one command as an argument array and runs it with runCommand.
// If a future llama.cpp renames a flag, only this file changes.
// SRS: REQ-9 (pinned binaries present), REQ-12 (convert + quantize), REQ-13 (smoke test),
// REQ-17 (benchmark), REQ-18 (perplexity + task accuracy).
// Owner: Sibghatullah (WP-04, benchmark WP-14, quality tests WP-16).
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../config/settings.js';
import { runCommand } from '../utils/runCommand.js';
import { appError } from '../utils/errors.js';

export const LEVELS = ['Q5_K_M', 'Q4_K_M', 'Q8_0'];
export const SMOKE_PROMPT = 'The capital of France is';

const isWindows = process.platform === 'win32';
const minutes = (n) => n * 60_000;

// Where things are inside LLAMA_CPP_DIR (layout made by `npm run setup:llamacpp`).
export function toolPath(name) {
  return path.join(settings.llamaCppDir, 'bin', isWindows ? `${name}.exe` : name);
}
export function pythonPath() {
  const venv = path.join(settings.llamaCppDir, 'venv');
  return isWindows ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
}

// Is the pinned llama.cpp installed? Throws E-TOOL-01 if not (used by preflight, REQ-9).
export function checkInstalled() {
  const versionFile = path.join(settings.llamaCppDir, 'VERSION');
  const installed = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : '';
  if (!settings.llamaCppDir || installed !== settings.llamaCppRef) {
    throw appError('E-TOOL-01', {
      message: `llama.cpp ${settings.llamaCppRef} not found in LLAMA_CPP_DIR (found: ${installed || 'nothing'}).`,
    });
  }
  return installed;
}

// safetensors folder → one F16 GGUF file.
// modelName is written into the file. Without it the converter uses the FOLDER name, so the same
// model downloaded into another folder would give a different SHA-256 (found in WP-06).
export async function convertToF16(modelDir, outFile, { onLine, modelName } = {}) {
  const script = path.join(settings.llamaCppDir, 'src', 'convert_hf_to_gguf.py');
  const args = [script, modelDir, '--outfile', outFile, '--outtype', 'f16'];
  if (modelName) args.push('--model-name', modelName);
  const result = await runCommand(pythonPath(), args, {
    onLine,
    timeoutMs: minutes(settings.timeoutsMin.convert),
  });
  if (result.code !== 0) throw appError('E-CONV-01');
  return { durationSec: result.durationSec };
}

// F16 GGUF → smaller GGUF at one level (e.g. Q4_K_M).
export async function quantize(f16File, outFile, level, { onLine } = {}) {
  if (!LEVELS.includes(level)) throw appError('E-LVL-01');
  const result = await runCommand(toolPath('llama-quantize'), [f16File, outFile, level], {
    onLine,
    timeoutMs: minutes(settings.timeoutsMin.quantize),
  });
  if (result.code !== 0)
    throw appError('E-QNT-01', { message: `Quantization to ${level} failed.` });
  return { durationSec: result.durationSec };
}

// Speed test of one file with llama-bench (WP-14): read a prompt (pp) and write tokens (tg),
// each repeated `runs` times, CPU only. Returns llama-bench's JSON: one entry per test, with the
// average speed (avg_ts), its spread (stddev_ts) and every run (samples_ts) in tokens/s.
// Demo mode uses a shorter test (CLAUDE.md §7.4).
export async function benchmark(file, { onLine, onSpawn, runs = 3 } = {}) {
  const sizes = settings.demoMode ? { prompt: 128, gen: 32 } : { prompt: 512, gen: 128 };
  const args = [
    '-m', file,
    '-p', String(sizes.prompt), // prompt test: read this many tokens
    '-n', String(sizes.gen), // generation test: write this many tokens
    '-r', String(runs), // repeat each test, so we can see how stable the numbers are
    '-ngl', '0', // CPU only, so results are comparable
    '-o', 'json',
  ]; // prettier-ignore
  if (settings.benchThreads > 0) args.push('-t', String(settings.benchThreads));

  const result = await runCommand(toolPath('llama-bench'), args, {
    // stdout is the JSON answer — only stderr (loading messages) goes to the job log
    onLine: (line, stream) => stream === 'stderr' && onLine?.(line),
    onSpawn,
    timeoutMs: minutes(settings.timeoutsMin.bench),
  });
  if (result.code !== 0) throw appError('E-BENCH-01');
  try {
    return { tests: JSON.parse(result.stdout), sizes, durationSec: result.durationSec };
  } catch {
    throw appError('E-BENCH-01', { message: 'llama-bench did not print valid JSON.' });
  }
}

// Quality test 1 (WP-16): perplexity on a fixed text — how "surprised" the model is by real
// Wikipedia text, chunk by chunk (512 tokens each). Lower = better. llama-perplexity prints
// "Final estimate: PPL = 18.9165 +/- 0.34990" at the end.
export async function perplexity(file, textFile, { chunks, onLine } = {}) {
  const args = [
    '-m', file,
    '-f', textFile,
    '-c', '512', // context: 512 tokens per chunk (CLAUDE.md §7.2)
    '--chunks', String(chunks), // 100 chunks (10 in demo mode)
    '-ngl', '0',
  ]; // prettier-ignore
  if (settings.benchThreads > 0) args.push('-t', String(settings.benchThreads));

  const result = await runCommand(toolPath('llama-perplexity'), args, {
    onLine: (line, stream) => stream === 'stderr' && onLine?.(line), // stdout = 100 numbers
    timeoutMs: minutes(settings.timeoutsMin.perplexity),
  });
  const found = result.lines.join('\n').match(/Final estimate: PPL = ([\d.]+) \+\/- ([\d.]+)/);
  if (result.code !== 0 || !found) throw appError('E-EVAL-01', { message: 'Perplexity failed.' });
  return { value: Number(found[1]), plusMinus: Number(found[2]), durationSec: result.durationSec };
}

// Quality test 2 (WP-16, evaluation E2): HellaSwag — for each task the model picks the most
// sensible of 4 sentence endings. llama.cpp picks the tasks with a FIXED seed, so every file is
// tested on the same tasks. The last stdout line is: "400  42.00000000%  [37.2618%, 46.8904%]"
// (tasks done, accuracy, 95 % confidence range).
export async function hellaswag(file, dataFile, { tasks, onLine } = {}) {
  const args = [
    '-m', file,
    '-f', dataFile,
    '--hellaswag',
    '--hellaswag-tasks', String(tasks), // 400 tasks (100 in demo mode)
    '-c', '512',
    '-ngl', '0',
  ]; // prettier-ignore
  if (settings.benchThreads > 0) args.push('-t', String(settings.benchThreads));

  const result = await runCommand(toolPath('llama-perplexity'), args, {
    onLine: (line, stream) => stream === 'stderr' && onLine?.(line), // stdout = one line per task
    timeoutMs: minutes(settings.timeoutsMin.perplexity),
  });
  const last = result.stdout.trim().split(/\r?\n/).pop() || '';
  const found = last.match(/^(\d+)\s+([\d.]+)%\s+\[([\d.]+)%,\s*([\d.]+)%\]/);
  if (result.code !== 0 || !found) throw appError('E-EVAL-01', { message: 'HellaSwag failed.' });
  return {
    tasks: Number(found[1]),
    accuracy: Number(found[2]),
    low: Number(found[3]),
    high: Number(found[4]),
    durationSec: result.durationSec,
  };
}

// Load a file and let it write 32 tokens. Valid = exits normally in time and prints text.
// In b12376 `llama-cli` is chat-only, so we use `llama-completion -no-cnv` (plain text mode).
export async function smokeTest(file, { onLine } = {}) {
  const args = [
    '-m', file,
    '-p', SMOKE_PROMPT,
    '-n', '32', // 32 new tokens
    '--seed', '42', // fixed seed + temperature 0 = same answer every run
    '--temp', '0',
    '-ngl', '0', // CPU only, so results are comparable
    '-no-cnv', // no chat mode: write the text and exit
    '--no-display-prompt', // stdout = only the generated text
  ]; // prettier-ignore
  try {
    const result = await runCommand(toolPath('llama-completion'), args, {
      onLine,
      timeoutMs: minutes(settings.timeoutsMin.smoke),
    });
    const output = result.stdout.trim();
    return {
      passed: result.code === 0 && output.length > 0,
      output,
      durationSec: result.durationSec,
    };
  } catch (err) {
    if (err.code === 'E-TIME-01') return { passed: false, output: 'Timed out.', durationSec: null };
    throw err; // e.g. E-TOOL-01: the program is missing — that is not a "failed file"
  }
}
