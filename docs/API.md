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

## Planned endpoints

Filled in as each WP lands (see `CLAUDE.md` §6): `/api/catalog` and `/api/profiles` (WP-05),
`/api/jobs/preflight` (WP-08), `/api/jobs` (WP-10), results (WP-15), downloads (WP-17),
recommendation and export (WP-19), auth (WP-21), admin (WP-25).
