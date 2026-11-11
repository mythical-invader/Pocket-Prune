// errors.js — every error code PocketPrune can return, with a plain message, a hint on how
// to fix it, and the HTTP status. The Help page (WP-25) lists the same codes.
// Usage:  throw appError('E-DISK-01')   or   throw appError('E-DISK-01', { hint: 'Free 4 GB…' })
// SRS: Section 3 (error messages), CLAUDE.md §7.6. Owner: Huzaifah.

export const ERRORS = {
  // Pipeline and preflight (CLAUDE.md §7.6)
  'E-CAT-01': [404, 'Model not in the catalog.', 'Pick a model from the Catalog page.'],
  'E-LVL-01': [400, 'Unsupported quantization level.', 'Choose Q5_K_M, Q4_K_M or Q8_0.'],
  'E-DISK-01': [409, 'Not enough free disk space.', 'Free some space or choose fewer levels.'],
  'E-RAM-01': [409, 'Not enough free RAM.', 'Close other programs or pick a smaller model.'],
  'E-LIC-01': [400, 'Licence not accepted.', 'Tick the licence box before submitting.'],
  'E-HF-01': [409, 'This gated model needs a Hugging Face token.', 'Set HF_TOKEN in .env.'],
  'E-HF-02': [502, 'Model download failed.', 'Check the internet connection and retry.'],
  'E-TOOL-01': [
    500,
    'llama.cpp is missing or the wrong version.',
    'Run scripts/build-llamacpp.sh on the model machine.',
  ],
  'E-CONV-01': [500, 'Conversion to GGUF failed.', 'See the job log for the tool output.'],
  'E-QNT-01': [500, 'Quantization failed.', 'See the job log for the tool output.'],
  'E-VAL-01': [
    500,
    'No file passed the smoke test.',
    'See the job log; try another level or model.',
  ],
  'E-TIME-01': [
    500,
    'A stage took longer than its time limit.',
    'Retry, or raise the TIMEOUT_* value in .env.',
  ],
  'E-WORKER-01': [500, 'The worker restarted while this job was running.', 'Retry the job.'],
  'E-AUTH-01': [401, 'Wrong email or password.', 'Check your details and try again.'],
  'E-LIMIT-01': [429, 'Too many active jobs.', 'Wait for a running job to finish.'],
  'E-QUOTA-01': [409, 'Storage limit reached.', 'Delete old files on the Downloads page.'],

  // General API errors
  'E-INPUT-01': [400, 'Some input is missing or invalid.', 'Check the highlighted fields.'],
  'E-NOTFOUND-01': [404, 'Not found.', 'Check the address or go back to the list.'],
  'E-SERVER-01': [
    500,
    'Something went wrong on the server.',
    'Try again; if it repeats, check the API terminal.',
  ],
};

// Build an Error that the error handler knows how to send. `extra` can override the
// message/hint or add `details` (e.g. which fields are invalid).
export function appError(code, extra = {}) {
  const [status, message, hint] = ERRORS[code] || ERRORS['E-SERVER-01'];
  const err = new Error(extra.message || message);
  err.code = code;
  err.status = status;
  err.hint = extra.hint || hint;
  if (extra.details) err.details = extra.details;
  return err;
}
