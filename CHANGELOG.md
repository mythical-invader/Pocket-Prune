# Changelog

All notable changes, grouped by release. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0-M2] — 2026-11-15

Phase 2 complete: a real compression job from the website, end to end (40 %). See
[docs/release-notes/M2.md](docs/release-notes/M2.md).

### Added

- WP-15: Results — `GET /api/jobs/:id/results` (every file vs F16 in %, size estimate vs real) and the
  Results page with the `MetricsTable` comparison.

- WP-13: pipeline hardening — timeouts stop the whole process tree, 2 GB disk reserve checked
  before each heavy step (E-DISK-01), unfinished jobs leave no files, downloads deleted after
  conversion (demo models kept), `npm run regression` + `docs/regression-M2.md`.

- WP-12: Job Progress page (`/jobs/:id`) — refreshes every 2 s: stage stepper, progress bar, elapsed
  time, queue position, log panel, error with fix and code, "FAKE DATA" badge, files made;
  `errorHint` in `GET /api/jobs/:id`.

- WP-11: background worker (`npm run dev:worker`) — picks the oldest queued job atomically, runs the
  real or fake pipeline, heartbeat every 10 s, cancel between stages, stuck jobs → `E-WORKER-01`.

- WP-10: jobs API — `POST /api/jobs` (202, preflight again, 2-job limit), `GET /api/jobs`,
  `GET /api/jobs/:id` (status, queue position, latest 50 log lines); "Start compression" on Job Setup.

- WP-08: preflight — `POST /api/jobs/preflight` with 9 checks (catalog, levels, profile, disk, RAM,
  licence, HF token, llama.cpp, 2-job limit) and the live checklist on the Job Setup page.

## [0.1.0-M1] — 2026-11-15

Phase 1 complete: setup + first compression. See [docs/release-notes/M1.md](docs/release-notes/M1.md).

### Added

- WP-00: shared MongoDB Atlas database (seeded with the catalog and demo user).

- WP-09: `npm run validate:catalog` (checks every catalog model on Hugging Face), `npm run fetch:wikitext`
  (WikiText-2 with SHA-256 check), tool temp files kept in `data/tmp`, measured F16 sizes in the
  seed, every catalog model tried with the CLI (`docs/catalog-trials.md`).

- WP-05: catalog API (`GET /api/catalog`, `/api/catalog/:id`), device profiles API (CRUD, own data
  only), `npm run seed` with 8 models pinned to Hugging Face commits, catalog rules (4 B limit).

- WP-07: website foundation — theme tokens as CSS variables, reusable components (Button, Card,
  Badge, StatusBadge, ProgressBar, StageStepper, PageHeader, EmptyState, ErrorAlert, Loader,
  Field, CompressionLadder, JobSummary), pipeline-rail layout, Catalog, Profiles and Job Setup
  pages, API service, job draft context.

### Fixed

- API reads `API_PORT` instead of `PORT`, so it never takes the website's port (#40).

- WP-03: settings and MongoDB connection, Mongoose models (User, CatalogModel, DeviceProfile, Job,
  JobEvent), error codes with the shared `{ code, message, hint }` error handler, temporary
  demo-user `protect`, `GET /api/system/health`, `GET /api/system/host-profile`, tests on an
  in-memory MongoDB.

- WP-01: project structure, root scripts (`install-all`, `dev`, `dev:worker`, `dev:all`, `seed`,
  `test`, `build`, `lint`, `progress`), Express API skeleton with first test, React + Vite website
  skeleton, worker/seed placeholders, `.env.example`, project docs, `progress.json` +
  `npm run progress`, PR/issue templates, CI workflow.
