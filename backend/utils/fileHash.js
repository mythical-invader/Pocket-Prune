// fileHash.js — SHA-256 "fingerprint" and size of a file on disk.
// The same bytes always give the same SHA-256, so a user can check that a downloaded GGUF is
// exactly the file we made, and repeated jobs can be compared (reproducibility).
// The file is read as a stream, so even a multi-GB model never has to fit in memory.
// SRS: REQ-14 (size + SHA-256 of every file), REQ-30. Owner: Sibghatullah (WP-06).
import crypto from 'node:crypto';
import fs from 'node:fs';

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

// Size in MiB with one decimal (what the website shows as "MB").
export function fileSizeMb(filePath) {
  return Math.round((fs.statSync(filePath).size / 1024 / 1024) * 10) / 10;
}
