# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 0 % merged (in review: 3 %, in progress: 1 %)
Huzaifah: 0 %  ·  Sibghatullah: 0 %
Next checkpoint: Phase 1 (M1) on 2026-11-22 (11 days) — 25 % to go
Waiting: WP-03, WP-07 (H) need WP-01 (in review) · WP-02 (S) needs WP-00 (in progress)
```

_Last updated: 11 Nov 2026 — Huzaifah (WP-01)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                           | Title                                    | Owner | Status      | Branch / PR                      | Notes                                                                              |
| ---------------------------- | ---------------------------------------- | ----- | ----------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| WP-00                        | GitHub setup + shared Atlas database     | Both  | in-progress | —                                | Repo, labels, milestones, issues done; collaborator, branch protection, Atlas left |
| WP-01                        | Project setup                            | H     | in-review   | `chore/wp01-project-setup`       | Skeletons, scripts, docs, CI                                                       |
| WP-02                        | llama.cpp setup + first hand compression | S     | not-started | `chore/wp02-llamacpp-setup`      |                                                                                    |
| WP-03                        | Backend core                             | H     | not-started | `feat/wp03-backend-core`         | Needs WP-01                                                                        |
| WP-04                        | Command runner                           | S     | not-started | `feat/wp04-command-runner`       | Needs WP-01, WP-02                                                                 |
| WP-05                        | Catalog + profiles API                   | H     | not-started | `feat/wp05-catalog-profiles-api` | Needs WP-03                                                                        |
| WP-06                        | CLI pipeline + fake pipeline             | S     | not-started | `feat/wp06-cli-pipeline`         | Needs WP-04                                                                        |
| WP-07                        | Website foundation                       | H     | not-started | `feat/wp07-website-foundation`   | Needs WP-01                                                                        |
| WP-08 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)       |       | not-started |                                  | Phases 2–5                                                                         |

## What works now

- `npm run install-all` installs everything; `npm run dev` starts the API (port 8000) and the website (port 5173) together on Windows.
- `GET /api` answers `{ "name": "PocketPrune API", "status": "ok" }`; the website shows "API: connected".
- `npm test` (1 test), `npm run build`, `npm run lint`, `npm run progress`.
- CI on every pull request: lint, backend tests, website build.

## What's next

- **Huzaifah:** WP-03 Backend core (after WP-01 merges), then WP-07 Website foundation.
- **Sibghatullah:** review WP-01; WP-02 llama.cpp setup on the model machine (WSL2).
- **Both:** finish WP-00 — create the MongoDB Atlas M0 cluster and share `MONGO_URI`.

## Known issues

- None yet.

## How to run what exists

See the [README](../README.md#run-it). Short version:

```bash
npm run install-all
copy .env.example .env      # Windows (cp on Linux/WSL)
npm run dev
```
