# API reference

Base URL: `http://localhost:8000/api` (the website reaches it as `/api` through the Vite proxy).

**Auth:** "user" endpoints run through `protect`. Until login exists (WP-21) `protect` acts as the
demo user `demo@pocketprune.local` (created automatically); no token is needed yet.

## Errors

Every error has the same shape. `details` appears only for invalid input.

```json
{
  "code": "E-INPUT-01",
  "message": "Some input is missing or invalid.",
  "hint": "Check the highlighted fields.",
  "details": { "ramMb": "Path `ramMb` is required." }
}
```

| Code            | HTTP | Meaning                                                    |
| --------------- | ---- | ---------------------------------------------------------- |
| `E-CAT-01`      | 404  | Model not in the catalog                                   |
| `E-LVL-01`      | 400  | Unsupported quantization level                             |
| `E-DISK-01`     | 409  | Not enough free disk space                                 |
| `E-RAM-01`      | 409  | Not enough free RAM                                        |
| `E-LIC-01`      | 400  | Licence not accepted                                       |
| `E-HF-01`       | 409  | Gated model needs a Hugging Face token                     |
| `E-HF-02`       | 502  | Model download failed                                      |
| `E-TOOL-01`     | 500  | llama.cpp missing or wrong version                         |
| `E-CONV-01`     | 500  | Conversion to GGUF failed                                  |
| `E-QNT-01`      | 500  | Quantization failed                                        |
| `E-VAL-01`      | 500  | No file passed the smoke test                              |
| `E-TIME-01`     | 500  | A stage took longer than its time limit                    |
| `E-WORKER-01`   | 500  | Worker restarted while the job was running                 |
| `E-AUTH-01`     | 401  | Wrong email or password                                    |
| `E-LIMIT-01`    | 429  | Too many active jobs                                       |
| `E-QUOTA-01`    | 409  | Storage limit reached                                      |
| `E-INPUT-01`    | 400  | Missing/invalid input, bad JSON, duplicate value           |
| `E-NOTFOUND-01` | 404  | Unknown address or id                                      |
| `E-SERVER-01`   | 500  | Unexpected server error (details only in the API terminal) |

The full messages and hints are in `backend/utils/errors.js`.

## Endpoints available now

### `GET /api` — public

```json
{ "name": "PocketPrune API", "status": "ok" }
```

### `GET /api/system/health` — public

Is the API up, can it reach MongoDB, which llama.cpp build and mode does it use?

```json
{ "status": "ok", "database": "connected", "llamaCppRef": "b0000", "demoMode": false }
```

`database` is `"connected"` or `"disconnected"`.

### `GET /api/system/host-profile` — user

This server's hardware. The Profiles page uses it for "Use this computer's values".

```json
{
  "machineName": "MythicalInvader",
  "platform": "Windows_NT 10.0.26300",
  "cpuModel": "11th Gen Intel(R) Core(TM) i5-1145G7 @ 2.60GHz",
  "cpuThreads": 8,
  "ramMb": 15765,
  "freeRamMb": 4390,
  "freeDiskMb": 322891
}
```

`freeDiskMb` is measured on the drive that holds `DATA_DIR` (model files).

### `GET /api/catalog` — user

Active catalog models, demo models first, then smallest first. Fill it with `npm run seed`.

```json
[
  {
    "_id": "6af4a0…",
    "hfRepoId": "HuggingFaceTB/SmolLM2-135M-Instruct",
    "revision": "12fd25f77366fa6b3b4b768ec3050bf629380bac",
    "displayName": "SmolLM2 135M Instruct",
    "paramsBillion": 0.135,
    "license": "Apache-2.0",
    "gated": false,
    "isActive": true,
    "isDemo": true,
    "f16SizeMb": 257,
    "createdAt": "…",
    "updatedAt": "…"
  }
]
```

### `GET /api/catalog/:id` — user

One active model. Unknown, switched-off or malformed id → `404 E-CAT-01`.

### `GET /api/profiles` — user

The current user's device profiles, oldest first.

```json
[
  {
    "_id": "6af4ac…",
    "user": "6af4a0…",
    "name": "My laptop",
    "ramMb": 16384,
    "freeDiskMb": 102400,
    "cpuThreads": 8,
    "preference": "balanced"
  }
]
```

### `POST /api/profiles` — user → `201`

```json
{
  "name": "My laptop",
  "ramMb": 16384,
  "freeDiskMb": 102400,
  "cpuThreads": 8,
  "preference": "speed"
}
```

| Field        | Rule                                                   |
| ------------ | ------------------------------------------------------ |
| `name`       | required, up to 60 characters                          |
| `ramMb`      | required, ≥ 256                                        |
| `freeDiskMb` | required, ≥ 0                                          |
| `cpuThreads` | required, ≥ 1                                          |
| `preference` | `quality`, `speed`, `smallest` or `balanced` (default) |

Invalid values → `400 E-INPUT-01` with `details` per field. A `user` field in the body is ignored.

### `GET /api/profiles/:id`, `PUT /api/profiles/:id`, `DELETE /api/profiles/:id` — user

Read, update (same body and rules as POST) or delete one of **your own** profiles. DELETE answers
`{ "deleted": true }`. Another user's profile, or an unknown id → `404 E-NOTFOUND-01`.

### `POST /api/jobs/preflight` — user

Checks whether a job can finish on this server, before anything heavy starts.

```json
{
  "modelId": "6af4a0…",
  "profileId": "6af4ac…",
  "levels": ["Q5_K_M", "Q4_K_M"],
  "licenseAccepted": true
}
```

Always answers `200` with every check (a failed check is a normal answer, not an error):

```json
{
  "passed": false,
  "checks": [
    {
      "id": "model",
      "label": "Model is in the catalog",
      "passed": true,
      "message": "SmolLM2 135M Instruct, pinned to 12fd25f."
    },
    {
      "id": "disk",
      "label": "Enough free disk space",
      "passed": false,
      "code": "E-DISK-01",
      "message": "Needs 2.9 GB free, only 1.0 GB free.",
      "hint": "Free 1.9 GB or choose fewer levels."
    }
  ]
}
```

Check ids, in order: `model` (E-CAT-01), `levels` (E-LVL-01), `profile` (E-NOTFOUND-01), `disk`
(E-DISK-01), `ram` (E-RAM-01), `licence` (E-LIC-01), `token` (E-HF-01), `tool` (E-TOOL-01; skipped
when `FAKE_PIPELINE=true`), `jobs` (E-LIMIT-01). `disk` and `ram` are left out when the model or
levels are invalid.

### `POST /api/jobs` — user → `202`

Same body as preflight. Preflight runs again on the server; if it passes, a job is saved with
status `QUEUED` and the worker picks it up later.

```json
{ "jobId": "6af9ad572fed54075071f4b8" }
```

If preflight fails, the answer is the **first** failed check's error (e.g. `400 E-LIC-01`,
`409 E-DISK-01`, `429 E-LIMIT-01`), with `details` listing every failed check:

```json
{
  "code": "E-LVL-01",
  "message": "Unsupported quantization level.",
  "hint": "Choose Q5_K_M, Q4_K_M or Q8_0.",
  "details": { "levels": "E-LVL-01: …", "licence": "E-LIC-01: Licence not accepted." }
}
```

### `GET /api/jobs` — user

Your jobs, newest first (up to 100), with `model.displayName`, `model.hfRepoId` and `profile.name`.
`variants` and `recommendation` are left out to keep the list small.

### `GET /api/jobs/:id` — user

One of your jobs with its model and profile, plus:

- `queuePosition` — `1` = next to run (only while `QUEUED`, otherwise `null`)
- `events` — the latest 50 log lines, oldest first: `{ stage, level, message, createdAt }`
- `errorHint` — for a `FAILED` job, the "how to fix" text of its `errorCode` (from `errors.js`),
  e.g. `"Set HF_TOKEN in .env."`; otherwise `null`

The Job Progress page (WP-12) asks for this every 2 s until the status is `COMPLETED`, `FAILED`
or `CANCELLED`.

```json
{
  "_id": "6af9ad57…",
  "status": "QUEUED",
  "stage": "Waiting in queue",
  "progressPct": 0,
  "quantLevels": ["Q5_K_M", "Q4_K_M"],
  "model": {
    "displayName": "SmolLM2 135M Instruct",
    "hfRepoId": "HuggingFaceTB/SmolLM2-135M-Instruct"
  },
  "queuePosition": 1,
  "events": [
    {
      "stage": "QUEUED",
      "level": "info",
      "message": "Job created: Q5_K_M, Q4_K_M. Waiting for the worker."
    }
  ]
}
```

Someone else's job, an unknown or a malformed id → `404 E-NOTFOUND-01`.

### `GET /api/jobs/:id/results` — user

The comparison of a **completed** job (own jobs only). Not finished → `404 E-NOTFOUND-01` "No
results yet: the job has not finished."

```json
{
  "status": "COMPLETED",
  "model": { "displayName": "SmolLM2 135M Instruct", "hfRepoId": "…", "revision": "12fd25f…" },
  "profile": { "name": "My laptop", "preference": "balanced" },
  "fake": false,
  "demoMode": false,
  "llamaCppRef": "b12376",
  "metrics": [{ "key": "fileSizeMb", "label": "Size", "unit": "MB", "better": "lower" }],
  "measured": ["fileSizeMb", "tpsPrompt", "tpsGen", "peakRamMb", "perplexity"],
  "rows": [
    {
      "level": "Q4_K_M",
      "values": { "fileSizeMb": 100.6, "tpsGen": 199, "perplexity": 19.87 },
      "vsF16": { "fileSizeMb": -61.1, "tpsGen": 89.5, "perplexity": 5 },
      "estimatedSizeMb": 79.3,
      "estimateErrorPct": -21.2,
      "smokePassed": true,
      "sha256": "…"
    }
  ],
  "recommendation": null
}
```

- `rows`: F16 first; `vsF16` = (value − F16) ÷ F16 × 100, `null` for F16 itself or a missing number.
- `measured`: which metrics exist for this job (before WP-14/16 a real job has only `fileSizeMb`).
- `estimatedSizeMb` / `estimateErrorPct`: the size predicted before the job and how far off it was (E1).

## Planned endpoints

Filled in as each WP lands (see `CLAUDE.md` §6): cancel / retry (WP-22),
downloads (WP-17), recommendation and export (WP-19), auth (WP-21), admin (WP-25).
