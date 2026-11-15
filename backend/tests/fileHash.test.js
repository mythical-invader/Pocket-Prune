// fileHash.test.js — SHA-256 and size of a file. Owner: Sibghatullah (WP-06).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileSizeMb, sha256File } from '../utils/fileHash.js';

describe('fileHash', () => {
  it('gives the known SHA-256 of "hello" and the size in MB', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pp-hash-')), 'a.txt');
    fs.writeFileSync(file, 'hello');

    // Known value: sha256("hello")
    expect(await sha256File(file)).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
    expect(fileSizeMb(file)).toBe(0);

    fs.writeFileSync(file, Buffer.alloc(3 * 1024 * 1024)); // exactly 3 MiB
    expect(fileSizeMb(file)).toBe(3);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
});
