# Git & GitHub guide

Our GitHub history is part of the grade (~20 marks). It should show **both** of us working in
small, real steps — and stay simple enough to explain in the viva.

Repository: https://github.com/mythical-invader/Pocket-Prune

## How the branches work

```text
main                 ← finished, reviewed work only
├── huzaifah         ← Huzaifah's branch
│   └── wp08-preflight, wp10-jobs-api …
└── sibghatullah     ← Sibghatullah's branch
    └── wp02-llamacpp-setup, wp04-command-runner …
```

1. Each WP gets a **small branch** off your own branch: `wpNN-short-name`.
2. When the WP works: **PR into your own branch** and merge it.
3. Then **PR your branch → `main`**. The other member reviews it (at least one comment) and merges
   with **Create a merge commit**.
4. A WP counts as done (`merged` in `docs/progress.json`) only when it is on `main`.

## Rules

- **Never push to `main` directly.**
- **2–3 commits per WP**, short plain captions, e.g. `WP-08: add preflight checks`.
- **One WP per PR.** Don't start a WP whose **Needs** (in `docs/progress.json`) aren't on `main`.
- **Secrets never go to GitHub.** Atlas connection string, HF token, JWT secret, passwords: only in
  your local `.env` (it is git-ignored). Check `git status` before every commit.
- Commit with **your own name and email** on **your own laptop**.

## One-time setup

**Each member, once per laptop:**

```bash
git config --global user.name "Your Real Name"
git config --global user.email "the-email-on-your-github-account"
git clone https://github.com/mythical-invader/Pocket-Prune.git
cd Pocket-Prune
git checkout sibghatullah        # or huzaifah
```

**Repo owner (done):** repository, labels, milestones, one issue per WP, the `huzaifah` and
`sibghatullah` branches. Still to do: add Sibghatullah as collaborator (Settings → Collaborators).
Branch protection on a private repo needs GitHub Pro (free with the
[Student Developer Pack](https://education.github.com/pack)); until then follow the rules by hand.

**Shared database:** one member creates a free **MongoDB Atlas M0** cluster and shares the
connection string privately (WhatsApp, not GitHub). Both put it in `.env` as `MONGO_URI`.

## Every work package

**▶ START** (example for Sibghatullah)

```bash
git checkout sibghatullah
git pull
git merge origin/main
git checkout -b wp02-llamacpp-setup
```

**▶ COMMIT** (2–3 times per WP)

```bash
git add .
git status          # no .env, no data/, no model files
git commit -m "WP-02: build llama.cpp"
```

**▶ END**

```bash
npm test
git push -u origin wp02-llamacpp-setup
```

1. On GitHub: PR **wp02-llamacpp-setup → sibghatullah**, merge it.
2. PR **sibghatullah → main**: title `WP-02: llama.cpp setup`, short body (what, how tested,
   `Closes #3`). Ask the other member to review and merge.

**▶ AFTER MERGE**

```bash
git checkout sibghatullah
git pull
git merge origin/main
git branch -d wp02-llamacpp-setup
```

**▶ MILESTONE** (after its last PR reaches `main`)

```bash
git checkout main
git pull
git tag -a v0.1.0-M1 -m "M1: setup + first compression"
git push origin v0.1.0-M1
```

## Reviewing the other member's PR into `main`

1. Open the PR → **Files changed** and read it.
2. If it changes behaviour, try it: `git fetch`, `git checkout <their-branch>`, `npm test`.
3. Leave at least one real comment, then **Approve** and **Merge (Create a merge commit)**.

## Issue numbers

WP-00 … WP-26 are issues #1 … #27, WP-M1 … WP-M4 are #28 … #31, WP-27 … WP-32 are #32 … #37.

## Common problems

| Problem                      | Fix                                                                         |
| ---------------------------- | --------------------------------------------------------------------------- |
| Pushed to the wrong branch   | Tell the other member before doing anything; don't force-push.              |
| Committed `.env` by accident | `git rm --cached .env`, commit, and **change every leaked password/token**. |
| Your branch is behind `main` | `git checkout <your-branch> && git pull && git merge origin/main`           |
| Wrong author on commits      | Fix `git config user.name/user.email` before the next commit.               |
