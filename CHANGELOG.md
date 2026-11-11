# Changelog

All notable changes, grouped by release. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
