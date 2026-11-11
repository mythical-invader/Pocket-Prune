// systemInfo.js — reads this computer's RAM, free disk and CPU threads.
// Used by /api/system/host-profile ("Use this computer's values" on the Profiles page) and,
// from WP-08, by the preflight RAM and disk checks. SRS: REQ-4, REQ-7, REQ-8, REQ-21.
// Owner: Huzaifah.
import fs from 'node:fs/promises';
import os from 'node:os';

const toMb = (bytes) => Math.round(bytes / 1024 / 1024);

// Free disk space (MB) on the drive that holds `folder`. Works on Windows and Linux.
export async function getFreeDiskMb(folder) {
  const stats = await fs.statfs(folder);
  return toMb(stats.bavail * stats.bsize); // bavail = blocks free for normal users
}

export async function getHostProfile(folder) {
  return {
    machineName: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    cpuModel: os.cpus()[0]?.model.trim() || 'unknown',
    cpuThreads: os.availableParallelism(),
    ramMb: toMb(os.totalmem()),
    freeRamMb: toMb(os.freemem()),
    freeDiskMb: await getFreeDiskMb(folder),
  };
}
