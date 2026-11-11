// catalogService.js — rules about which models may be in the catalog.
// Used by seed.js now and by the admin catalog page later (WP-25). SRS: REQ-2, REQ-3.
// Owner: Huzaifah.
import { settings } from '../config/settings.js';

// A pinned revision is a full 40-character Git commit hash, e.g. "12fd25f7…0bac".
const COMMIT_HASH = /^[0-9a-f]{40}$/;

// Returns a list of problems with a catalog entry (empty list = OK).
export function checkCatalogEntry(entry) {
  const problems = [];
  if (!entry.hfRepoId?.includes('/')) problems.push('hfRepoId must look like "owner/model".');
  if (!COMMIT_HASH.test(entry.revision || ''))
    problems.push('revision must be a full 40-character commit hash.');
  if (!(entry.paramsBillion > 0)) problems.push('paramsBillion must be a positive number.');
  if (entry.paramsBillion > settings.maxParamsBillion)
    problems.push(`Larger than the ${settings.maxParamsBillion} B parameter limit.`);
  return problems;
}
