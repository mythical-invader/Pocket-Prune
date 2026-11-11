# API reference

Base URL: `http://localhost:8000/api` (the website reaches it as `/api` through the Vite proxy).

Every error has the same shape (from WP-03):

```json
{
  "code": "E-DISK-01",
  "message": "Not enough free disk space.",
  "hint": "Free 4 GB or choose fewer levels."
}
```

## Endpoints available now

### `GET /api`

Skeleton check that the API is running. Public.

```http
GET /api
```

```json
{ "name": "PocketPrune API", "status": "ok" }
```

## Planned endpoints

Filled in as each WP lands (see `CLAUDE.md` §6): `/api/system/health` and `/api/system/host-profile`
(WP-03), `/api/catalog` and `/api/profiles` (WP-05), `/api/jobs/preflight` (WP-08), `/api/jobs`
(WP-10), results (WP-15), downloads (WP-17), recommendation and export (WP-19), auth (WP-21),
admin (WP-25).
