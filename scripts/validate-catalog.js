// validate-catalog.js — checks every catalog model against Hugging Face WITHOUT downloading it:
//   1. the pinned revision really exists (REQ-2)
//   2. that revision has .safetensors weights (we never accept .bin — REQ-11)
//   3. the REAL parameter count (from the safetensors metadata) is under the 4 B limit (REQ-3)
//      and matches what seedData.js says (within 3 %)
//   4. gated models are marked gated: true (they need HF_TOKEN)
// Run with: npm run validate:catalog   (needs internet; exits with code 1 if anything is wrong)
// Owner: Sibghatullah (WP-09).
import { CATALOG_SEED } from '../backend/seedData.js';
import { checkCatalogEntry } from '../backend/services/catalogService.js';
import { settings } from '../backend/config/settings.js';

async function checkModel(entry) {
  const problems = checkCatalogEntry(entry); // the same rules seed.js uses
  const url = `https://huggingface.co/api/models/${entry.hfRepoId}/revision/${entry.revision}`;
  const res = await fetch(url);
  if (!res.ok) return { problems: [...problems, `revision not found (HTTP ${res.status})`] };
  const info = await res.json();

  const files = (info.siblings || []).map((f) => f.rfilename);
  if (!files.some((f) => f.endsWith('.safetensors'))) problems.push('no .safetensors weights');

  const realParams = (info.safetensors?.total || 0) / 1e9;
  if (realParams > settings.maxParamsBillion)
    problems.push(`real size ${realParams.toFixed(2)} B > limit`);
  if (realParams && Math.abs(realParams - entry.paramsBillion) / realParams > 0.03) {
    problems.push(
      `paramsBillion says ${entry.paramsBillion}, Hugging Face says ${realParams.toFixed(3)}`
    );
  }

  const gated = Boolean(info.gated);
  if (gated !== Boolean(entry.gated)) problems.push(`gated is ${gated} on Hugging Face`);

  return { realParams, gated, problems };
}

const rows = [];
for (const entry of CATALOG_SEED) {
  const result = await checkModel(entry).catch((err) => ({ problems: [err.message] }));
  rows.push({
    model: entry.hfRepoId,
    revision: entry.revision.slice(0, 8),
    'params (B)': result.realParams ? Number(result.realParams.toFixed(3)) : '?',
    gated: result.gated ? 'yes' : 'no',
    result: result.problems.length ? `✖ ${result.problems.join('; ')}` : 'OK',
  });
}
console.table(rows);
const bad = rows.filter((r) => r.result !== 'OK').length;
console.log(
  bad ? `${bad} model(s) need fixing in backend/seedData.js` : 'All catalog models are valid.'
);
process.exitCode = bad ? 1 : 0;
