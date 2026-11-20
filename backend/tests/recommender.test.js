// recommender.test.js — one test per recommender rule (CLAUDE.md §7.3), plus E3: the
// recommender against two naive methods, "always Q4_K_M" and "largest file that fits"
// (docs/EVALUATION_PLAN.md). Plain data, no database, no llama.cpp.
// Owner: Sibghatullah (WP-18).
import {
  candidates,
  compareWithBaselines,
  fits,
  qualityLoss,
  recommend,
  RULES,
} from '../services/recommender.js';

// A measured file. ram = peak RAM (MB), tps = generation tok/s, ppl = perplexity.
const file = (level, sizeMb, ram, tps, ppl, extra = {}) => ({
  level,
  fileSizeMb: sizeMb,
  smokePassed: true,
  metrics: { peakRamMb: ram, tpsGen: tps, perplexity: ppl },
  ...extra,
});

// REAL numbers: SmolLM2-135M on the i7-14700HX (WP-14 / WP-16).
const SMOLLM = [
  file('F16', 258.3, 471, 105, 18.92, { fileDeleted: true }),
  file('Q5_K_M', 106.9, 319, 191, 19.57),
  file('Q4_K_M', 100.6, 320, 199, 19.87),
];

// ILLUSTRATIVE numbers for a ~1.5 B model (sizes from docs/catalog-trials.md, RAM ≈ size +
// 200 MB, speed and perplexity in the pattern SmolLM2 showed). WP-20 replaces them with real ones.
const MID = [
  file('F16', 2944, 3150, 14, 9.5, { fileDeleted: true }),
  file('Q8_0', 1570, 1770, 25, 9.52),
  file('Q5_K_M', 1090, 1290, 32, 9.71),
  file('Q4_K_M', 940, 1140, 36, 9.95),
];

const profile = (name, ramMb, freeDiskMb, preference = 'balanced') => ({
  name,
  ramMb,
  freeDiskMb,
  preference,
});
const LAPTOP_16 = profile('Laptop 16 GB', 16384, 50000);

describe('which files can be recommended', () => {
  it('skips F16, failed smoke tests, deleted files and files without speed/RAM numbers', () => {
    const variants = [
      ...SMOLLM,
      file('Q8_0', 137, 350, 160, 18.95, { smokePassed: false }),
      { level: 'Q4_K_M', fileSizeMb: 100, smokePassed: true, metrics: { perplexity: 19 } },
    ];
    expect(candidates(variants).map((v) => v.level)).toEqual(['Q5_K_M', 'Q4_K_M']);
  });

  it('gives "no-measurements" when nothing has numbers', () => {
    const rec = recommend([SMOLLM[0]], LAPTOP_16);
    expect(rec).toMatchObject({ chosenLevel: null, ruleFired: 'no-measurements' });
  });
});

describe('rule 1 — fits', () => {
  it('needs peak RAM ≤ 75 % of the device RAM', () => {
    const q4 = MID[3]; // 1140 MB peak RAM
    expect(fits(q4, profile('a', 1520, 50000))).toBe(true); // 75 % = 1140
    expect(fits(q4, profile('b', 1519, 50000))).toBe(false);
  });

  it('needs size ≤ free disk − 2 GB', () => {
    const q4 = MID[3]; // 940 MB
    expect(fits(q4, profile('a', 16384, 940 + 2048))).toBe(true);
    expect(fits(q4, profile('b', 16384, 939 + 2048))).toBe(false);
  });

  it('never recommends a file that does not fit', () => {
    // 2 GB RAM → limit 1536 MB: Q8_0 (1770 MB) is out, even for "quality"
    const rec = recommend(MID, profile('Phone 2 GB', 2048, 8000, 'quality'));
    expect(rec.chosenLevel).toBe('Q5_K_M');
    expect(rec.baselineLargest).toBe('Q5_K_M');
  });
});

describe('rule 2 — quality guard', () => {
  it('measures the loss against F16', () => {
    expect(qualityLoss(SMOLLM[2], 18.92)).toBeCloseTo(0.0502, 3);
    expect(qualityLoss(file('Q4_K_M', 1, 1, 1, undefined), 18.92)).toBeNull();
  });

  it('skips a file that loses > 10 % when a better one fits', () => {
    const variants = [
      file('F16', 300, 500, 100, 20, { fileDeleted: true }),
      file('Q5_K_M', 120, 330, 180, 21), // +5 %
      file('Q4_K_M', 100, 300, 200, 23), // +15 % → dropped
    ];
    const rec = recommend(variants, profile('Laptop', 8192, 50000, 'speed'));
    expect(rec).toMatchObject({ chosenLevel: 'Q5_K_M', ruleFired: 'speed', qualityRisk: false });
    expect(rec.explanation).toContain('Q4_K_M fits too but was skipped');
  });

  it('still recommends (with qualityRisk) when every file that fits loses > 10 %', () => {
    const variants = [
      file('F16', 300, 500, 100, 20, { fileDeleted: true }),
      file('Q5_K_M', 120, 330, 180, 23), // +15 %
      file('Q4_K_M', 100, 300, 200, 24), // +20 %
    ];
    const rec = recommend(variants, profile('Laptop', 8192, 50000, 'quality'));
    expect(rec).toMatchObject({
      chosenLevel: 'Q5_K_M',
      ruleFired: 'quality-risk',
      qualityRisk: true,
    });
    expect(rec.explanation).toContain('Warning');
  });
});

describe('rule 3 — preference', () => {
  it('quality → lowest perplexity', () => {
    expect(recommend(MID, profile('L', 16384, 50000, 'quality')).chosenLevel).toBe('Q8_0');
  });

  it('speed → fastest generation', () => {
    expect(recommend(MID, profile('L', 16384, 50000, 'speed')).chosenLevel).toBe('Q4_K_M');
  });

  it('smallest → smallest file', () => {
    expect(recommend(MID, profile('L', 16384, 50000, 'smallest')).chosenLevel).toBe('Q4_K_M');
  });

  it('balanced → best 0.4 speed + 0.4 quality + 0.2 size', () => {
    // each value scaled 0–1 among the three files (1 = best):
    // Q8_0:   speed 0.00, quality 1.00, size 0.00 → 0.40
    // Q5_K_M: speed 0.64, quality 0.56, size 0.76 → 0.25 + 0.22 + 0.15 = 0.63  ← best
    // Q4_K_M: speed 1.00, quality 0.00, size 1.00 → 0.60
    const rec = recommend(MID, profile('L', 16384, 50000, 'balanced'));
    expect(rec).toMatchObject({ chosenLevel: 'Q5_K_M', ruleFired: 'balanced' });
  });

  it('uses file size as the quality stand-in when perplexity was not measured', () => {
    const noPpl = MID.map((v) => ({ ...v, metrics: { ...v.metrics, perplexity: undefined } }));
    const rec = recommend(noPpl, profile('L', 16384, 50000, 'quality'));
    expect(rec.chosenLevel).toBe('Q8_0');
    expect(rec.explanation).toContain('was not measured');
  });
});

describe('rule 4 — tie', () => {
  it('picks the smaller file when two files score the same', () => {
    const variants = [file('Q5_K_M', 120, 330, 200, 20), file('Q4_K_M', 100, 300, 200, 21)];
    const rec = recommend(variants, profile('L', 8192, 50000, 'speed'));
    expect(rec).toMatchObject({ chosenLevel: 'Q4_K_M', ruleFired: 'tie-smaller-file' });
  });
});

describe('rule 5 — nothing fits', () => {
  it('says how much RAM and disk would be needed', () => {
    const rec = recommend(MID, profile('Old phone', 1024, 1000));
    expect(rec).toMatchObject({ chosenLevel: null, ruleFired: 'nothing-fits' });
    // lightest: Q4_K_M 1140 MB / 0.75 = 1520 MB → 1.5 GB RAM; 940 + 2048 MB → 2.9 GB disk
    expect(rec.explanation).toContain('1.5 GB of RAM');
    expect(rec.explanation).toContain('2.9 GB of free disk');
  });
});

describe('rule 6 — baselines + explanation', () => {
  it('reports the smallest and the largest file that fits', () => {
    const rec = recommend(MID, LAPTOP_16);
    expect(rec).toMatchObject({ baselineSmallest: 'Q4_K_M', baselineLargest: 'Q8_0' });
  });

  it('names the device, gives the numbers, and never promises', () => {
    const rec = recommend(SMOLLM, profile('My laptop', 16384, 50000, 'balanced'));
    expect(rec.explanation).toContain('"My laptop" (16.0 GB RAM');
    expect(rec.explanation).toContain(`${rec.chosenLevel} is the best match`);
    expect(rec.explanation).toMatch(/Perplexity \+\d+\.\d % vs the original F16/);
    expect(rec.explanation.toLowerCase()).not.toContain('guarantee');
    expect(RULES[rec.ruleFired]).toBeDefined();
  });

  it('warns when a compared file had an unstable speed test', () => {
    const variants = [
      file('Q5_K_M', 106.9, 153, 200, 21.76),
      file('Q4_K_M', 100.6, 155, 122, 22.08, {}),
    ];
    variants[1].metrics.unstable = true; // real demo-mode run, 20 Nov 2026
    const rec = recommend(variants, profile('L', 16384, 50000, 'speed'));
    expect(rec.chosenLevel).toBe('Q5_K_M');
    expect(rec.explanation).toContain('speed test of Q4_K_M varied by more than 10 %');
  });

  it('on the real SmolLM2-135M numbers: balanced and speed pick Q4_K_M, quality picks Q5_K_M', () => {
    const pick = (pref) => recommend(SMOLLM, profile('L', 16384, 50000, pref)).chosenLevel;
    expect(pick('balanced')).toBe('Q4_K_M');
    expect(pick('speed')).toBe('Q4_K_M');
    expect(pick('quality')).toBe('Q5_K_M');
  });
});

// ---------------------------------------------------------------------------------------------
// E3 — is the recommender better than a simple rule? For every device × preference, compare it
// with B-always-Q4 and B-largest-fits on the thing the user said matters most.
// ---------------------------------------------------------------------------------------------
describe('E3 — recommender vs baselines', () => {
  const DEVICES = [
    profile('Phone 2 GB', 2048, 8000),
    profile('Phone 4 GB', 4096, 16000),
    profile('Laptop 8 GB', 8192, 40000),
    profile('Laptop 16 GB', 16384, 100000),
  ];
  const PREFERENCES = ['quality', 'speed', 'balanced'];
  // A risky small model: Q4_K_M loses 14 % (the guard should avoid it).
  const RISKY = [
    file('F16', 700, 900, 40, 12.0, { fileDeleted: true }),
    file('Q5_K_M', 280, 480, 70, 12.9), // +7.5 %
    file('Q4_K_M', 260, 450, 75, 13.7), // +14 %
  ];
  const MODELS = { MID, RISKY, SMOLLM };

  // Higher = better for that preference (only used among files that fit and pass the guard).
  const value = (row, pref) => (pref === 'speed' ? row.tpsGen : -row.qualityLoss);

  const cases = [];
  for (const [model, variants] of Object.entries(MODELS)) {
    for (const device of DEVICES) {
      for (const preference of PREFERENCES) {
        const p = { ...device, preference };
        cases.push({ model, preference, device: p, rows: compareWithBaselines(variants, p) });
      }
    }
  }

  it('the recommender always picks a file that fits (always-Q4 does not check)', () => {
    for (const c of cases) {
      const [rec] = c.rows;
      if (rec.level) expect(rec.fits).toBe(true);
    }
  });

  it('never picks a file that loses > 10 % when a safer one fits', () => {
    for (const c of cases.filter((x) => x.model === 'RISKY')) {
      const [rec] = c.rows;
      if (rec.level) expect(rec.qualityLoss).toBeLessThanOrEqual(0.1);
    }
  });

  it('is never worse than a baseline on speed or quality preferences', () => {
    for (const c of cases.filter((x) => x.preference !== 'balanced')) {
      const [rec, ...baselines] = c.rows;
      for (const b of baselines) {
        const usable = b.level && b.fits && b.qualityLoss <= 0.1;
        if (usable) expect(value(rec, c.preference)).toBeGreaterThanOrEqual(value(b, c.preference));
      }
    }
  });

  it('beats each baseline in some real cases (it is not just a copy of either)', () => {
    const differs = (i) => cases.filter((c) => c.rows[0].level !== c.rows[i].level).length;
    expect(differs(1)).toBeGreaterThan(0); // differs from always-Q4
    expect(differs(2)).toBeGreaterThan(0); // differs from largest-fits
  });

  it('example cases from the E3 table', () => {
    const levels = (model, device, pref) =>
      cases
        .find((c) => c.model === model && c.device.name === device && c.preference === pref)
        .rows.map((r) => r.level);
    // quality on a 2 GB phone: Q8_0 doesn't fit → recommender and largest-fits take Q5_K_M
    expect(levels('MID', 'Phone 2 GB', 'quality')).toEqual(['Q5_K_M', 'Q4_K_M', 'Q5_K_M']);
    // speed on 16 GB: "bigger is better" picks the slow Q8_0
    expect(levels('MID', 'Laptop 16 GB', 'speed')).toEqual(['Q4_K_M', 'Q4_K_M', 'Q8_0']);
    // risky model: always-Q4 takes the file that loses 14 %
    expect(levels('RISKY', 'Laptop 8 GB', 'speed')).toEqual(['Q5_K_M', 'Q4_K_M', 'Q5_K_M']);
  });
});
