# PocketPrune — Edge LLM Compression & Deployment Toolkit

PocketPrune takes a small open-source language model from Hugging Face and, in the background,
checks your machine, downloads the model, converts it to GGUF with llama.cpp, quantizes it to
**Q5_K_M** and **Q4_K_M**, smoke-tests each file, measures size, speed, peak RAM and perplexity,
and **recommends the best file for your device** with simple, explainable rules.

> Status: early development — see [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) or run
> `npm run progress`.

## Tech stack

MongoDB + Mongoose · Node.js 22 + Express · React + Vite · a separate Node worker process ·
llama.cpp (pinned release) · Vitest + supertest · GitHub Actions.

## Which machine runs what

| Machine       | Who          | OS                            | Runs                                                                               |
| ------------- | ------------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| Model machine | Sibghatullah | Windows 11 (Linux also works) | llama.cpp, the worker, real compressions and benchmarks; API + website when needed |
| Web machine   | Huzaifah     | Windows                       | API + website (no llama.cpp or WSL2 needed)                                        |

Both use one shared **MongoDB Atlas M0** database during development (same `MONGO_URI`).

## Install

You need **Node.js 22 LTS or newer** and **Git**.

### Windows (web machine)

```bash
git clone https://github.com/mythical-invader/Pocket-Prune.git
cd Pocket-Prune
npm run install-all
copy .env.example .env
```

Open `.env` and set `MONGO_URI` to the shared Atlas connection string (ask your teammate).

### llama.cpp (model machine)

Needs **Python 3.12** (Windows: the `py` launcher) as well. Then, after the steps above:

```bash
# In .env set LLAMA_CPP_DIR to a folder without spaces, e.g. D:/llama.cpp
npm run setup:llamacpp
```

This downloads llama.cpp **b12376** (the official Windows CPU build; on Linux it builds the same tag
with CMake) and creates a Python venv for the converter. It takes a few minutes and about 2 GB.
Running it again does nothing if that tag is already installed.

Tip (Windows): add the repo's `data` folder to Windows Defender's exclusions — it otherwise scans
every multi-hundred-MB model file as it is written.

## Run it

| Command                           | What it starts                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`                     | API (http://localhost:8000/api) + website (http://localhost:5173) — works on Windows |
| `npm run dev:worker`              | The background worker (model machine)                                                |
| `npm run dev:all`                 | API + website + worker together (model machine)                                      |
| `npm run seed`                    | Fill the database with catalog models and demo users (from WP-05)                    |
| `npm test`                        | Backend tests                                                                        |
| `npm run build`                   | Production build of the website                                                      |
| `npm run lint` / `npm run format` | Check / fix code style                                                               |
| `npm run progress`                | Project % done, per phase and per person, and who is waiting on whom                 |

Open http://localhost:5173 — the page should say **API: connected**.

## Project layout

```text
backend/    Express API (app.js, server.js), worker/, tests/
frontend/   React website (Vite)
scripts/    Helper scripts (progress.js; llama.cpp build script from WP-02)
docs/       Status, dev log, how it works, learning notes, Git guide, API, SRS, roadmap
deploy/     Docker files (WP-26)
data/       Model files and downloads — git-ignored, created at run time
```

## Documentation

- [Project status](docs/PROJECT_STATUS.md) · [Dev log](docs/DEV_LOG.md) · [How it works](docs/HOW_IT_WORKS.md)
- [Learning notes](docs/LEARNING_NOTES.md) · [Git guide](docs/GIT_GUIDE.md) · [API](docs/API.md)
- [SRS](docs/PocketPrune_SRS.docx) · [Implementation roadmap](docs/PocketPrune_Implementation_Roadmap.pdf)
- Project rules for the AI coding assistant: [CLAUDE.md](CLAUDE.md)

## Pinned tool versions

| Tool      | Version                                                               |
| --------- | --------------------------------------------------------------------- |
| Node.js   | 22 LTS (Node 20 is end-of-life since April 2026)                      |
| llama.cpp | **b12376** (`LLAMA_CPP_REF`), installed with `npm run setup:llamacpp` |
