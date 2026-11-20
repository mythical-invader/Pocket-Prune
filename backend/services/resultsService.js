// resultsService.js — turns a finished job into the comparison the Results page shows:
// every file's size, speed, peak RAM, perplexity and task accuracy, plus how much each changed
// versus the F16 baseline, the ± ranges, the machine, which files can be downloaded, and the size
// estimate made before the job vs the real size (evaluation E1).
// Plain functions with no database calls, so they are easy to test.
// SRS: REQ-17, REQ-20, REQ-21, REQ-28, REQ-30. Owner: Huzaifah (WP-15, WP-17).
import { estimateSizeMb } from '../utils/sizeEstimate.js';

// The numbers we compare. `better` says which direction is good, so the website can colour a
// change green or red: smaller files, less RAM and lower perplexity are better; faster is better.
export const METRICS = [
  { key: 'fileSizeMb', label: 'Size', unit: 'MB', better: 'lower' },
  { key: 'tpsPrompt', label: 'Prompt speed', unit: 'tok/s', better: 'higher' },
  { key: 'tpsGen', label: 'Generation speed', unit: 'tok/s', better: 'higher' },
  { key: 'peakRamMb', label: 'Peak RAM', unit: 'MB', better: 'lower' },
  { key: 'perplexity', label: 'Perplexity', unit: '', better: 'lower', range: 'perplexityStd' },
  // WP-16 / E2 (added by Sibghatullah): % of HellaSwag tasks answered correctly.
  // It is already a percentage, so its change vs F16 is in percentage POINTS (40.8 − 42.0 =
  // −1.2 pp), not a relative % (that would read −2.9 %). `range` = the ± the tool reports.
  {
    key: 'taskAccuracy',
    label: 'Task accuracy (HellaSwag)',
    unit: '%',
    better: 'higher',
    change: 'points',
    range: 'taskAccuracyMargin',
  },
];

// (value − base) ÷ base × 100, rounded to 0.1 %. null when either number is missing.
export function pctChange(value, base) {
  if (value === null || value === undefined || !base) return null;
  return Math.round(((value - base) / base) * 1000) / 10;
}

// value − base, rounded to 0.1 (for numbers that are already percentages).
export function pointsChange(value, base) {
  if (value === null || value === undefined || base === null || base === undefined) return null;
  return Math.round((value - base) * 10) / 10;
}

// Size sits on the variant itself; the other numbers are inside `metrics` (WP-14 / WP-16).
function valueOf(variant, key) {
  if (!variant) return null;
  if (key === 'fileSizeMb') return variant.fileSizeMb ?? null;
  return variant.metrics?.[key] ?? null;
}

// One row of the comparison table.
export function compareVariant(variant, f16, f16SizeMbFromCatalog) {
  const values = {};
  const vsF16 = {};
  const ranges = {}; // the ± range of a measurement, when the tool reports one (WP-16)
  for (const { key, change, range } of METRICS) {
    values[key] = valueOf(variant, key);
    const compare = change === 'points' ? pointsChange : pctChange;
    vsF16[key] = variant.level === 'F16' ? null : compare(values[key], valueOf(f16, key));
    if (range) ranges[key] = variant.metrics?.[range] ?? null;
  }

  // E1: what the website estimated before the job vs what the file really is.
  const estimatedSizeMb = estimateSizeMb(f16SizeMbFromCatalog, variant.level);
  return {
    level: variant.level,
    values,
    vsF16,
    ranges,
    smokePassed: variant.smokePassed ?? null,
    // Can it be downloaded? Only files that passed and still exist (F16 is deleted after
    // evaluation, WP-16 — its numbers stay as the baseline).
    downloadable: Boolean(variant.smokePassed) && !variant.fileDeleted,
    fileDeleted: Boolean(variant.fileDeleted),
    sha256: variant.sha256 ?? null,
    estimatedSizeMb: estimatedSizeMb === null ? null : Math.round(estimatedSizeMb * 10) / 10,
    estimateErrorPct:
      variant.level === 'F16' ? null : pctChange(estimatedSizeMb, values.fileSizeMb),
    unstable: variant.metrics?.unstable ?? false,
  };
}

// The whole Results answer for one completed job.
export function buildResults(job) {
  const variants = job.variants ?? [];
  const f16 = variants.find((v) => v.level === 'F16');
  const order = ['F16', 'Q8_0', 'Q5_K_M', 'Q4_K_M']; // biggest to smallest, F16 first
  const rows = [...variants]
    .sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))
    .map((v) => compareVariant(v, f16, job.model?.f16SizeMb));

  // Which numbers exist at all: before WP-14/16 a real job only has sizes and smoke tests.
  const measured = METRICS.filter(({ key }) => rows.some((r) => r.values[key] !== null)).map(
    (m) => m.key
  );

  // The machine the numbers were measured on (REQ-21): llama-bench saves the CPU and threads.
  const bench = variants.find((v) => v.metrics?.settings?.cpu)?.metrics.settings;
  const machine = bench ? { cpu: bench.cpu, threads: bench.threads ?? null } : null;

  return {
    jobId: job._id,
    status: job.status,
    machine,
    model: job.model
      ? {
          displayName: job.model.displayName,
          hfRepoId: job.model.hfRepoId,
          revision: job.model.revision,
        }
      : null,
    profile: job.profile ? { name: job.profile.name, preference: job.profile.preference } : null,
    fake: Boolean(job.fake),
    demoMode: Boolean(job.demoMode),
    llamaCppRef: job.llamaCppRef ?? null,
    finishedAt: job.finishedAt ?? null,
    metrics: METRICS,
    measured,
    rows,
    recommendation: job.recommendation?.chosenLevel ? job.recommendation : null,
  };
}
