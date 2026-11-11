# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(A companion Expo / React Native app reuses the same API, theme tokens and component names later;
it is not started yet.)

## Users

- **Primary:** developers and CS students who want a small open-source language model (135 M – 4 B
  parameters) to run on their own laptop or phone, and need to know which compressed file fits
  their device and what quality and speed it costs.
- **Demo audience:** the FYP evaluation committee and supervisors watching live demos (mid-term
  7 Dec 2026, final April 2027), often on a projector. Results must read clearly from a distance.

## Product Purpose

PocketPrune automates a known route — Hugging Face model → GGUF (F16) → Q5_K_M / Q4_K_M with
llama.cpp — runs preflight checks before anything heavy, smoke-tests and benchmarks every file
(size, prompt and generation speed, peak RAM, perplexity on WikiText-2), and recommends the best
file for a stated device with explainable rules. Success: a user picks a model and a device
profile, watches the job progress, and leaves with a downloaded file and an honest reason why it
was recommended.

## Positioning

It does not invent a compression method. Its value is measured, reproducible trade-offs on the
user's own hardware (pinned model revisions, pinned llama.cpp build, fixed prompts and dataset)
and a recommendation that names the rule that fired. Never claims "guaranteed" results.

## Operating Context

- Jobs take minutes; the user starts one, then watches progress (refresh every 2 s) or comes back
  later to History / Results / Downloads.
- Runs on a single machine (Windows laptop for the website, Ubuntu/WSL2 model machine for the
  worker); shared MongoDB Atlas database during development.
- Pages: Login/Register, Catalog, Profiles, Job Setup, Job Progress, Results, History, Downloads,
  Help, Admin.

## Capabilities and Constraints

- Levels: F16 baseline always, Q5_K_M and Q4_K_M (Q8_0 optional). Catalog is curated; no uploads.
- Every error shows code, what failed, why, and how to fix it (e.g. `E-DISK-01`). Always show units
  (MB, tok/s, %).
- Jargon policy: keep the real terms (Q4_K_M, GGUF, perplexity, tok/s) and add a one-line plain
  hint beside them; the Help page explains in depth.
- Design must port to React Native: one token file (`frontend/src/theme/theme.js`, palette fixed in
  CLAUDE.md §9), shared component names, no backdrop blur, complex gradients or hover-only
  information, layouts built from stacked cards that work at phone width, minimal animation,
  lucide icons.
- Code must stay simple enough for a classmate to read (JS/JSX, no TypeScript).

## Brand Commitments

- Name: **PocketPrune** — "Edge LLM Compression & Deployment Toolkit".
- Palette and type scale fixed in CLAUDE.md §9 (primary `#2F5DE1`, Inter / system-ui).
- BSCS Final Year Project, Lahore Garrison University.

## Evidence on Hand

- No real benchmark numbers yet (first hand compression is WP-02). Never invent metrics, users,
  testimonials or performance claims; sample numbers only via the clearly labelled fake pipeline.

## Product Principles

1. Measured, not promised: every claim on screen comes from a run on this machine.
2. Fail early and explain: preflight before heavy work; every error says how to fix it.
3. Explainable choice: show the rule that fired and the baselines it beat.
4. Readable at a glance and from a projector.
5. Same look on web and phone.
