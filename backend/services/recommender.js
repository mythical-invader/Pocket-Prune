// recommender.js — picks the best compressed file for ONE device, with simple rules a person can
// check by hand (CLAUDE.md §7.3). Plain functions, no database: the pipeline calls it after the
// measurements (WP-18), and POST /api/jobs/:id/recommend (WP-19) calls it again for another
// device profile.
//   Rule 1 Fits:       peak RAM ≤ 75 % of the device RAM, and size ≤ free disk − 2 GB.
//   Rule 2 Quality:    drop files whose perplexity is > 10 % worse than F16 — unless nothing
//                      else fits (then qualityRisk = true).
//   Rule 3 Preference: quality → lowest perplexity · speed → fastest generation ·
//                      smallest → smallest file · balanced → 0.4 speed + 0.4 quality + 0.2 size.
//   Rule 4 Tie:        the smaller file wins.
//   Rule 5 Nothing fits: say how much RAM / disk would be needed.
//   Rule 6 Baselines:  also report the smallest and the largest file that fits.
// compareWithBaselines() puts the choice next to two naive methods (E3, docs/EVALUATION_PLAN.md).
// SRS: REQ-22, REQ-23. Owner: Sibghatullah (WP-18).

export const RAM_SHARE = 0.75; // leave a quarter of the RAM for the OS and other apps
export const DISK_RESERVE_MB = 2048; // keep 2 GB free on the device after the download
export const MAX_QUALITY_LOSS = 0.1; // perplexity may be at most 10 % worse than F16
export const BALANCED_WEIGHTS = { speed: 0.4, quality: 0.4, size: 0.2 };

// Every value of ruleFired, in plain words (for the recommendation card and the Help page).
export const RULES = {
  quality: 'Preference "quality": the file with the lowest perplexity that fits.',
  speed: 'Preference "speed": the fastest file that fits.',
  smallest: 'Preference "smallest": the smallest file that fits.',
  balanced: 'Preference "balanced": best mix of speed (40 %), quality (40 %) and size (20 %).',
  'tie-smaller-file': 'Two files scored the same, so the smaller one was chosen.',
  'quality-risk': 'Every file that fits loses more than 10 % quality; the best of them was chosen.',
  'nothing-fits': 'No file fits this device.',
  'no-measurements': 'No file has speed and RAM measurements, so nothing can be recommended.',
};

// Files that can be recommended: quantized, passed the smoke test, still on disk, and measured.
// (F16 is only the baseline — it is deleted after evaluation.)
export function candidates(variants) {
  return variants.filter(
    (v) =>
      v.level !== 'F16' &&
      v.smokePassed &&
      !v.fileDeleted &&
      v.metrics?.peakRamMb > 0 &&
      v.metrics?.tpsGen > 0
  );
}

// Rule 1.
export function fits(variant, profile) {
  return (
    variant.metrics.peakRamMb <= RAM_SHARE * profile.ramMb &&
    variant.fileSizeMb <= profile.freeDiskMb - DISK_RESERVE_MB
  );
}

// How much worse than F16 a file's perplexity is: 0.05 = 5 % worse. null = not measured.
export function qualityLoss(variant, f16Perplexity) {
  const p = variant.metrics?.perplexity;
  if (!p || !f16Perplexity) return null;
  return (p - f16Perplexity) / f16Perplexity;
}

// Scale a value to 0–1 among the files (1 = best). All equal → everyone gets 1.
function scale(value, values, higherIsBetter) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return higherIsBetter ? (value - min) / (max - min) : (max - value) / (max - min);
}

// A "quality" number where higher = better. Perplexity if every file has it; otherwise the
// file size stands in (a bigger file keeps more of the original numbers).
function qualityValues(files) {
  const measured = files.every((f) => f.metrics.perplexity > 0);
  return files.map((f) => (measured ? -f.metrics.perplexity : f.fileSizeMb));
}

// Rule 3 (+ rule 4): a score per file for the preference; highest wins, ties → smaller file.
export function scoreFiles(files, preference) {
  const quality = qualityValues(files);
  const speed = files.map((f) => f.metrics.tpsGen);
  const size = files.map((f) => f.fileSizeMb);
  return files.map((file, i) => {
    let score;
    if (preference === 'quality') score = quality[i];
    else if (preference === 'speed') score = speed[i];
    else if (preference === 'smallest') score = -size[i];
    else {
      score =
        BALANCED_WEIGHTS.speed * scale(speed[i], speed, true) +
        BALANCED_WEIGHTS.quality * scale(quality[i], quality, true) +
        BALANCED_WEIGHTS.size * scale(size[i], size, false);
    }
    return { file, score };
  });
}

function pickBest(files, preference) {
  const scored = scoreFiles(files, preference);
  const top = Math.max(...scored.map((s) => s.score));
  const best = scored
    .filter((s) => Math.abs(s.score - top) < 1e-9)
    .map((s) => s.file)
    .sort((a, b) => a.fileSizeMb - b.fileSizeMb); // rule 4: the smaller file wins a tie
  return { file: best[0], tie: best.length > 1 };
}

// Why the chosen file won, per preference (first sentence of the explanation).
const REASONS = {
  quality: 'it keeps the most quality (lowest perplexity) of the files that fit.',
  speed: 'it is the fastest of the files that fit.',
  smallest: 'it is the smallest file that fits.',
  balanced: 'it has the best mix of speed, quality and size of the files that fit.',
};

const bySize = (a, b) => a.fileSizeMb - b.fileSizeMb;
const gb = (mb) => `${(mb / 1024).toFixed(1)} GB`;
const pct = (loss) => `${loss >= 0 ? '+' : ''}${(loss * 100).toFixed(1)} %`;

// The main function. variants = job.variants; profile = { name, ramMb, freeDiskMb, preference }.
export function recommend(variants, profile) {
  const preference = profile.preference || 'balanced';
  const device = `"${profile.name}" (${gb(profile.ramMb)} RAM, ${gb(profile.freeDiskMb)} free disk, preference: ${preference})`;
  const empty = { chosenLevel: null, baselineSmallest: null, baselineLargest: null };
  const files = candidates(variants);

  if (files.length === 0) {
    return {
      ...empty,
      ruleFired: 'no-measurements',
      explanation: `No file has speed and RAM measurements, so nothing can be recommended for ${device}.`,
      qualityRisk: false,
    };
  }

  // Rule 1 + rule 5
  const fitting = files.filter((f) => fits(f, profile)).sort(bySize);
  if (fitting.length === 0) {
    const smallest = [...files].sort(bySize)[0];
    const needRam = Math.min(...files.map((f) => Math.ceil(f.metrics.peakRamMb / RAM_SHARE)));
    const needDisk = smallest.fileSizeMb + DISK_RESERVE_MB;
    return {
      ...empty,
      ruleFired: 'nothing-fits',
      explanation:
        `No file fits ${device}. The lightest one needs about ${gb(needRam)} of RAM ` +
        `(its peak use is at most 75 % of the RAM) and ${gb(needDisk)} of free disk ` +
        '(the file plus 2 GB to spare). Try a smaller model, or free some RAM or disk.',
      qualityRisk: false,
    };
  }

  // Rule 2: drop files that lose > 10 % quality — unless that would leave nothing.
  const f16 = variants.find((v) => v.level === 'F16');
  const p0 = f16?.metrics?.perplexity;
  const safe = fitting.filter((f) => {
    const loss = qualityLoss(f, p0);
    return loss === null || loss <= MAX_QUALITY_LOSS;
  });
  const qualityRisk = safe.length === 0;
  const pool = qualityRisk ? fitting : safe;

  // Rule 3 + rule 4
  const { file, tie } = pickBest(pool, preference);
  let ruleFired = preference;
  if (tie) ruleFired = 'tie-smaller-file';
  if (qualityRisk) ruleFired = 'quality-risk';

  // Plain-English explanation naming the device; never promises anything.
  const m = file.metrics;
  const loss = qualityLoss(file, p0);
  const parts = [
    `For ${device}, ${file.level} is the best match: ${REASONS[preference] || REASONS.balanced}`,
    `It needed ${Math.round(m.peakRamMb)} MB of RAM in our test (the limit is 75 % of the device RAM, ${gb(RAM_SHARE * profile.ramMb)}) and is ${file.fileSizeMb} MB on disk.`,
    `It generated ${m.tpsGen} tokens/s on the PocketPrune machine — your device may be faster or slower.`,
    loss === null
      ? 'Its perplexity was not measured, so its quality loss is unknown.'
      : `Perplexity ${pct(loss)} vs the original F16 model.`,
  ];
  if (tie) parts.push('Another file scored the same, so the smaller one was chosen.');
  // Speed numbers that varied > 10 % between runs (WP-14) make a speed comparison uncertain.
  const unstable = pool.filter((f) => f.metrics.unstable).map((f) => f.level);
  if (unstable.length && preference !== 'smallest') {
    parts.push(
      `Note: the speed test of ${unstable.join(', ')} varied by more than 10 % between runs, so the speed comparison is less certain.`
    );
  }
  if (qualityRisk) {
    parts.push(
      'Warning: every file that fits this device loses more than 10 % quality — answers may be noticeably worse.'
    );
  } else if (safe.length < fitting.length) {
    const dropped = fitting.filter((f) => !safe.includes(f)).map((f) => f.level);
    parts.push(`${dropped.join(', ')} fits too but was skipped: it loses more than 10 % quality.`);
  }

  return {
    chosenLevel: file.level,
    baselineSmallest: fitting[0].level, // rule 6
    baselineLargest: fitting[fitting.length - 1].level,
    ruleFired,
    explanation: parts.join(' '),
    qualityRisk,
  };
}

// E3: what the recommender picks next to two naive methods, with the numbers that matter.
//   always-Q4     — always take Q4_K_M (the usual internet advice), even if it does not fit;
//   largest-fits  — take the biggest file that fits ("bigger = better").
// Used by the E3 tests and by the WP-20 benchmark report.
export function compareWithBaselines(variants, profile) {
  const files = candidates(variants);
  const p0 = variants.find((v) => v.level === 'F16')?.metrics?.perplexity;
  const rec = recommend(variants, profile);
  const describe = (method, level) => {
    const f = files.find((x) => x.level === level);
    if (!f) return { method, level: null, fits: false };
    return {
      method,
      level,
      fits: fits(f, profile),
      sizeMb: f.fileSizeMb,
      tpsGen: f.metrics.tpsGen,
      perplexity: f.metrics.perplexity ?? null,
      qualityLoss: qualityLoss(f, p0),
    };
  };
  return [
    describe('recommender', rec.chosenLevel),
    describe('always-Q4', 'Q4_K_M'),
    describe('largest-fits', rec.baselineLargest),
  ];
}
