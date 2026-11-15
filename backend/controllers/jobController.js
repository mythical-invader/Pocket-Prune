// jobController.js — compression jobs. WP-08 adds the preflight check; creating, listing and
// following jobs arrive in WP-10. SRS: REQ-6 – REQ-10. Owner: Huzaifah.
import { runPreflight } from '../services/preflightService.js';

// POST /api/jobs/preflight  { modelId, levels, profileId, licenseAccepted }
// Always answers 200 with { passed, checks[] }: a failed check is a normal answer, not an error.
export async function preflight(req, res, next) {
  try {
    const { modelId, levels, profileId, licenseAccepted } = req.body;
    const result = await runPreflight({
      user: req.user,
      modelId,
      levels,
      profileId,
      licenseAccepted: licenseAccepted === true,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
