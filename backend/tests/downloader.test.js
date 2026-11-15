// downloader.test.js — checks the `hf download` command, reuse of an earlier download and the
// error codes. runCommand is mocked: no internet needed. Owner: Sibghatullah (WP-04).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { settings } from '../config/settings.js';
import { runCommand } from '../utils/runCommand.js';
import { downloadModel, modelDir } from '../worker/downloader.js';

vi.mock('../utils/runCommand.js', () => ({ runCommand: vi.fn() }));

const REPO = 'HuggingFaceTB/SmolLM2-135M-Instruct';
const REV = '12fd25f77366fa6b3b4b768ec3050bf629380bac';

// A fake successful download: the mocked hf "creates" a safetensors file.
const fakeDownload = () =>
  runCommand.mockImplementation(async () => {
    fs.mkdirSync(modelDir(REPO), { recursive: true });
    fs.writeFileSync(path.join(modelDir(REPO), 'model.safetensors'), 'x');
    return { code: 0, stdout: '', lines: [], durationSec: 2 };
  });

let tmp;
beforeEach(() => {
  runCommand.mockReset();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-data-'));
  settings.dataDir = tmp;
  settings.hfToken = '';
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('downloadModel', () => {
  it('downloads only safetensors/json/tokenizer at the pinned revision', async () => {
    fakeDownload();
    const result = await downloadModel(REPO, REV);

    const [, args] = runCommand.mock.calls[0];
    expect(args).toEqual([
      'download', REPO,
      '--revision', REV,
      '--include', '*.safetensors', '*.json', 'tokenizer*',
      '--local-dir', modelDir(REPO),
    ]); // prettier-ignore
    expect(args.join(' ')).not.toMatch(/\.bin/);
    expect(result).toMatchObject({ reused: false, dir: modelDir(REPO) });
    expect(modelDir(REPO)).toMatch(/HuggingFaceTB__SmolLM2-135M-Instruct$/);
  });

  it('reuses a finished download of the same revision without running hf', async () => {
    fakeDownload();
    await downloadModel(REPO, REV);
    runCommand.mockClear();

    const again = await downloadModel(REPO, REV);
    expect(again.reused).toBe(true);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('downloads again when the revision changed', async () => {
    fakeDownload();
    await downloadModel(REPO, REV);
    await downloadModel(REPO, 'another-commit');
    expect(runCommand).toHaveBeenCalledTimes(2);
  });

  it('passes the HF token in the environment, never in the arguments', async () => {
    settings.hfToken = 'hf_secret_test_value';
    fakeDownload();
    await downloadModel(REPO, REV);

    const [, args, options] = runCommand.mock.calls[0];
    expect(args.join(' ')).not.toContain('hf_secret_test_value');
    expect(options.env.HF_TOKEN).toBe('hf_secret_test_value');
    expect(options.env.HF_HOME).toBe(path.join(tmp, 'hf-cache'));
  });

  it('throws E-HF-02 when the download fails', async () => {
    runCommand.mockResolvedValue({ code: 1, stdout: '', lines: ['Connection error'] });
    await expect(downloadModel(REPO, REV)).rejects.toMatchObject({ code: 'E-HF-02' });
  });

  it('throws E-HF-01 when the model is gated (401/403)', async () => {
    runCommand.mockResolvedValue({
      code: 1,
      stdout: '',
      lines: ['401 Client Error: Unauthorized'],
    });
    await expect(downloadModel(REPO, REV)).rejects.toMatchObject({ code: 'E-HF-01' });
  });

  it('keeps a half-finished download so the next try can resume it (REQ-11)', async () => {
    runCommand.mockImplementation(async () => {
      fs.mkdirSync(modelDir(REPO), { recursive: true });
      fs.writeFileSync(path.join(modelDir(REPO), 'model-00001-of-00002.safetensors'), 'part');
      return { code: 1, stdout: '', lines: ['Connection reset'] };
    });
    await expect(downloadModel(REPO, REV)).rejects.toMatchObject({ code: 'E-HF-02' });
    expect(fs.existsSync(path.join(modelDir(REPO), 'model-00001-of-00002.safetensors'))).toBe(true);
    expect(fs.existsSync(path.join(modelDir(REPO), '.pocketprune-revision'))).toBe(false); // not reusable
  });

  it('removes the empty folder of a refused gated download (WP-13)', async () => {
    runCommand.mockImplementation(async () => {
      fs.mkdirSync(modelDir(REPO), { recursive: true });
      return { code: 1, stdout: '', lines: ['403 Forbidden: gated repo'] };
    });
    await expect(downloadModel(REPO, REV)).rejects.toMatchObject({ code: 'E-HF-01' });
    expect(fs.existsSync(modelDir(REPO))).toBe(false);
  });

  it('throws E-HF-02 when no safetensors file arrived', async () => {
    runCommand.mockImplementation(async () => {
      fs.mkdirSync(modelDir(REPO), { recursive: true });
      return { code: 0, stdout: '', lines: [] };
    });
    await expect(downloadModel(REPO, REV)).rejects.toMatchObject({ code: 'E-HF-02' });
  });
});
