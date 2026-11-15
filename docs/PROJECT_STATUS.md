# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 12 % merged (in progress: 5 %)
Phase 1 ██████████░░░░░░░░░░ 12/25 %
Huzaifah: 12 %  ·  Sibghatullah: 0 %
Next checkpoint: Phase 1 (M1) on 2026-11-22 (8 days) — 13 % to go: WP-00, WP-02, WP-04, WP-06
Ready to start: WP-08 (H)
Waiting: WP-04 (S) needs WP-02 (S, in-progress) · WP-06 (S) needs WP-04
```

_Last updated: 14 Nov 2026 — Sibghatullah (WP-02)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                           | Title                                    | Owner | Status      | Branch / PR                | Notes                                                                                               |
| ---------------------------- | ---------------------------------------- | ----- | ----------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| WP-00                        | GitHub setup + shared Atlas database     | Both  | in-progress | —                          | Repo, labels, milestones, issues done; collaborator, Atlas left; branch protection needs GitHub Pro |
| WP-01                        | Project setup                            | H     | merged      | #38                        | Skeletons, scripts, docs, CI                                                                        |
| WP-02                        | llama.cpp setup + first hand compression | S     | in-progress | `wp02-llamacpp-setup`      | Windows 11, llama.cpp b12376; SmolLM2-135M compressed by hand (3/3 smoke tests pass); revision OK   |
| WP-03                        | Backend core                             | H     | merged      | #39                        | Models, errors, health, host profile                                                                |
| WP-04                        | Command runner                           | S     | not-started | `feat/wp04-command-runner` | Needs WP-02                                                                                         |
| WP-05                        | Catalog + profiles API                   | H     | merged      | #42                        | Catalog, profiles CRUD, seed with pinned revisions                                                  |
| WP-06                        | CLI pipeline + fake pipeline             | S     | not-started | `feat/wp06-cli-pipeline`   | Needs WP-04                                                                                         |
| WP-07                        | Website foundation                       | H     | merged      | #41                        | Pipeline-rail layout, theme, components, Catalog/Profiles/Job Setup                                 |
| WP-08 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)       |       | not-started |                            | Phases 2–5                                                                                          |

## What works now

- `npm run seed` fills the catalog with 8 models pinned to exact Hugging Face commits (safe to run again).
- Website: pipeline rail (Model → Device → Preflight → Run → Results); **Catalog** shows the real models with compression ladders; **Profiles** saves, edits and deletes device profiles through the API ("Use this computer's values" fills the form); **Job Setup** shows levels with estimated sizes, the preflight checklist and the licence box.
- API: `/api/catalog`, `/api/catalog/:id`, `/api/profiles` (CRUD, own data only), `/api/system/health`, `/api/system/host-profile`. Every error comes back as `{ code, message, hint }`.
- `npm run install-all`, then `npm run dev` starts the API (port 8000) and the website (port 5173) on Windows.
- `npm test` (33 tests, in-memory MongoDB), `npm run build`, `npm run lint`, `npm run progress`; CI on every PR.

## What's next

- **Huzaifah:** WP-08 Preflight (ready now) — makes "Run preflight" on Job Setup work.
- **Sibghatullah:** finish WP-02 (commit, PR into `sibghatullah`, then into `main`), then WP-04 command runner.
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
