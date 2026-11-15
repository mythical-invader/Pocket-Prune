# Git & GitHub guide

Our GitHub history is part of the grade (~20 marks). It should show **both** of us working in
small, real steps — and stay simple enough to explain in the viva.

Repository: https://github.com/mythical-invader/Pocket-Prune

## How the branches work

_Simplified on 15 Nov 2026: no more WP sub-branches — each member commits straight onto their own
branch. WP-01 … WP-07 still used `wpNN-…` sub-branches, so both styles appear in the history._

```text
main                 ← finished, reviewed work only
├── huzaifah         ← Huzaifah commits his WPs here (WP-08, WP-10 …)
└── sibghatullah     ← Sibghatullah commits his WPs here (WP-09, WP-11 …)
```

1. Work on **your own branch** (`huzaifah` or `sibghatullah`): one WP at a time, 2–3 commits.
2. When the WP works: **PR your branch → `main`** (one WP per PR, `Closes #<issue>`).
3. The other member **reviews** it (at least one real comment). It is merged with **Create a merge
   commit**, so every WP shows up as one merge in the history. If the reviewer can't look in time,
   the author may merge once CI is green and the reviewer comments afterwards.
4. A WP counts as done (`merged` in `docs/progress.json`) only when it is on `main`.

## Rules

- **Never push to `main` directly.**
- **2–3 commits per WP**, short plain captions, e.g. `WP-08: add preflight checks`.
- **One WP per PR.** Don't start a WP whose **Needs** (in `docs/progress.json`) aren't on `main`.
- **Secrets never go to GitHub.** Atlas connection string, HF token, JWT secret, passwords: only in
  your local `.env` (it is git-ignored). Check `git status` before every commit.
- **Add files by name** (`git add backend/x.js docs/y.md`), not `git add .`, so nothing private
  slips in.
- Commit with **your own name and email** on **your own laptop**.
- No AI attribution lines (`Co-Authored-By`, "Generated with …") in commits or PRs.

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
`sibghatullah` branches, Sibghatullah added as collaborator. Branch protection on a private repo
needs GitHub Pro (free with the [Student Developer Pack](https://education.github.com/pack)); until
then follow the rules by hand.

**Shared database (done, 15 Nov 2026):** one free **MongoDB Atlas M0** cluster; both members put
the connection string in `.env` as `MONGO_URI` (shared privately, never on GitHub). If Node says
`querySrv ECONNREFUSED`, your computer can't do the DNS lookup a `mongodb+srv://` string needs —
use the standard form instead:
`mongodb://<user>:<password>@host1:27017,host2:27017,host3:27017/pocketprune?tls=true&authSource=admin&replicaSet=<name>`
(Atlas → Connect → Drivers can show it; Sibghatullah has a working one).

## Every work package

**▶ START** (example for Sibghatullah)

```bash
git checkout sibghatullah
git pull
git merge origin/main            # start from the latest main
```

**▶ COMMIT** (2–3 times per WP)

```bash
git add scripts/validate-catalog.js package.json      # by name
git status          # no .env, no data/, no .private-local/, no model files
git commit -m "WP-09: catalog validation and wikitext scripts"
```

**▶ END**

```bash
npm test
git push origin sibghatullah
gh pr create --base main --head sibghatullah --title "WP-09: Catalog trials"
gh pr checks --watch             # wait for CI
```

PR body: what, why, how tested, `Closes #10`. Ask the other member to review; merge with
**Create a merge commit**.

**▶ AFTER MERGE**

```bash
git checkout sibghatullah
git pull
git merge origin/main            # your branch now also has the merge commit
```

**▶ MILESTONE** (after its last PR reaches `main`)

```bash
git checkout main
git pull
git tag -a v0.1.0-M1 -m "M1: setup + first compression"
git push origin v0.1.0-M1
gh release create v0.1.0-M1 --notes-file docs/release-notes/M1.md
```

Then close the milestone on GitHub.

## Reviewing the other member's PR into `main`

1. Open the PR → **Files changed** and read it.
2. If it changes behaviour, try it: `git fetch`, `git checkout huzaifah` (or `sibghatullah`),
   `npm test`, then switch back to your own branch.
3. Leave at least one real comment, then **Approve** (and **Merge — Create a merge commit** if it
   isn't merged yet).

## Issue numbers

WP-00 … WP-26 are issues #1 … #27, WP-M1 … WP-M4 are #28 … #31, WP-27 … WP-32 are #32 … #37.

## Common problems

| Problem                      | Fix                                                                         |
| ---------------------------- | --------------------------------------------------------------------------- |
| Pushed to the wrong branch   | Tell the other member before doing anything; don't force-push.              |
| Committed `.env` by accident | `git rm --cached .env`, commit, and **change every leaked password/token**. |
| Your branch is behind `main` | `git checkout <your-branch> && git pull && git merge origin/main`           |
| Wrong author on commits      | Fix `git config user.name/user.email` before the next commit.               |
| `querySrv ECONNREFUSED`      | Use the standard `mongodb://` Atlas string (see Shared database above).     |
