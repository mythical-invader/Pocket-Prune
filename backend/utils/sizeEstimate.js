// sizeEstimate.js — expected file size of a level BEFORE a job runs, from the F16 size and the
// bits each level stores per weight (F16 = 16). Used by preflight (disk check) and by the
// results (estimate vs real size, evaluation plan E1). The website has the same table in
// frontend/src/utils/format.js. Owner: Huzaifah.
export const BITS_PER_WEIGHT = { F16: 16, Q8_0: 8.5, Q5_K_M: 5.7, Q4_K_M: 4.9 };

export function estimateSizeMb(f16SizeMb, level) {
  if (!f16SizeMb || !BITS_PER_WEIGHT[level]) return null;
  return (f16SizeMb * BITS_PER_WEIGHT[level]) / 16;
}
