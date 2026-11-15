// format.js — turns raw numbers into the text users read: sizes, speeds, percentages, dates.
// Always shows units. The mobile app copies this file. Owner: Huzaifah.

// 1536 → "1.5 GB", 420 → "420 MB"
export function formatMb(mb) {
  if (mb === undefined || mb === null || Number.isNaN(mb)) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

// 0.135 → "135 M", 1.544 → "1.5 B", 3.821 → "3.8 B" (parameters)
export function formatParams(billion) {
  if (billion < 1) return `${Math.round(billion * 1000)} M`;
  return `${Math.round(billion * 10) / 10} B`;
}

export function formatTps(tps) {
  return tps === undefined || tps === null ? '—' : `${tps.toFixed(1)} tok/s`;
}

export function formatPct(value) {
  return value === undefined || value === null
    ? '—'
    : `${value > 0 ? '+' : ''}${value.toFixed(1)} %`;
}

// 65 → "1 min 05 s", 9 → "9 s"
export function formatDuration(totalSec) {
  if (totalSec === undefined || totalSec === null || totalSec < 0) return '—';
  const sec = Math.round(totalSec);
  if (sec < 60) return `${sec} s`;
  return `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s`;
}

// "2026-11-15T17:55:55Z" → "22:55:55" (local time, for log lines)
export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Rough expected file size BEFORE a job runs, from the F16 size and the bits each level
// stores per weight (F16 = 16, Q8_0 ≈ 8.5, Q5_K_M ≈ 5.7, Q4_K_M ≈ 4.9). Small models keep some
// layers larger, so the real file is often a bit bigger — the UI labels these "≈ estimate".
const BITS_PER_WEIGHT = { F16: 16, Q8_0: 8.5, Q5_K_M: 5.7, Q4_K_M: 4.9 };

export function estimateSizeMb(f16SizeMb, level) {
  if (!f16SizeMb) return undefined;
  return (f16SizeMb * BITS_PER_WEIGHT[level]) / 16;
}

// Short plain-English hint shown next to each level name.
export const LEVEL_HINTS = {
  F16: 'Uncompressed baseline',
  Q8_0: '8-bit · near-original quality',
  Q5_K_M: '5-bit · balanced',
  Q4_K_M: '4-bit · smallest',
};
