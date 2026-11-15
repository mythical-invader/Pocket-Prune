# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 16 % merged (in progress: 4 %)
Phase 1 █████████████░░░░░░░ 16/25 %
Huzaifah: 12 %  ·  Sibghatullah: 4 %
Next checkpoint: Phase 1 (M1) on 2026-11-22 (7 days) — 9 % to go: WP-00, WP-04, WP-06
Ready to start: WP-08 (H)
Waiting: WP-06 (S) needs WP-04 (S, in-progress)
```

_Last updated: 15 Nov 2026 — Sibghatullah (WP-04)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                           | Title                                    | Owner | Status      | Branch / PR              | Notes                                                                                               |
| ---------------------------- | ---------------------------------------- | ----- | ----------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| WP-00                        | GitHub setup + shared Atlas database     | Both  | in-progress | —                        | Repo, labels, milestones, issues done; collaborator, Atlas left; branch protection needs GitHub Pro |
| WP-01                        | Project setup                            | H     | merged      | #38                      | Skeletons, scripts, docs, CI                                                                        |
| WP-02                        | llama.cpp setup + first hand compression | S     | merged      | #44                      | Windows 11, llama.cpp b12376; SmolLM2-135M compressed by hand (3/3 smoke tests pass); revision OK   |
| WP-03                        | Backend core                             | H     | merged      | #39                      | Models, errors, health, host profile                                                                |
| WP-04                        | Command runner                           | S     | in-progress | `sibghatullah`           | runCommand, llamacpp, downloader + 22 tests; real run on SmolLM2-135M passes                        |
| WP-05                        | Catalog + profiles API                   | H     | merged      | #42                      | Catalog, profiles CRUD, seed with pinned revisions                                                  |
| WP-06                        | CLI pipeline + fake pipeline             | S     | not-started | `feat/wp06-cli-pipeline` | Needs WP-04                                                                                         |
| WP-07                        | Website foundation                       | H     | merged      | #41                      | Pipeline-rail layout, theme, components, Catalog/Profiles/Job Setup                                 |
| WP-08 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)       |       | not-started |                          | Phases 2–5                                                                                          |

## What works now

- **llama.cpp b12376** on Windows (`npm run setup:llamacpp`); SmolLM2-135M compressed by hand (WP-02).
- **Node runs llama.cpp** (WP-04): `downloadModel`, `convertToF16`, `quantize`, `smokeTest` with time limits and log lines.
- `npm run seed` fills the catalog with 8 models pinned to exact Hugging Face commits (safe to run again).
- Website: pipeline rail (Model → Device → Preflight → Run → Results); **Catalog** shows the real models with compression ladders; **Profiles** saves, edits and deletes device profiles through the API ("Use this computer's values" fills the form); **Job Setup** shows levels with estimated sizes, the preflight checklist and the licence box.
- API: `/api/catalog`, `/api/catalog/:id`, `/api/profiles` (CRUD, own data only), `/api/system/health`, `/api/system/host-profile`. Every error comes back as `{ code, message, hint }`.
- `npm run install-all`, then `npm run dev` starts the API (port 8000) and the website (port 5173) on Windows.
- `npm test` (55 tests, in-memory MongoDB, no llama.cpp needed), `npm run build`, `npm run lint`, `npm run progress`; CI on every PR.

## What's next

- **Huzaifah:** WP-08 Preflight (ready now) — makes "Run preflight" on Job Setup work.
- **Sibghatullah:** WP-04 PR into `main`, then WP-06 (CLI pipeline + fake pipeline).
- **Both:** finish WP-00 — MongoDB Atlas M0 cluster and shared `MONGO_URI`.

## Known issues

- "Run preflight" and "Start compression" are disabled until WP-08 / WP-10.
- Branch protection on `main` is not active (private repo needs GitHub Pro / Student Pack). Follow the rule by hand.

## How to run what exists

See the [README](../README.md#run-it). Short version:

```bash
npm run install-all
copy .env.example .env      # Windows (cp on Linux/WSL)
npm run seed
npm run dev
```

You need a MongoDB to connect to: the shared Atlas string in `MONGO_URI`, or a local MongoDB.
