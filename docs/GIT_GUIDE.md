# Git & GitHub guide

Our GitHub history is part of the grade (~20 marks). It must show **both** of us working in small,
real steps: feature branch → pull request → review by the other member → merge into `main`.

Repository: https://github.com/mythical-invader/Pocket-Prune

## Rules

1. **Never push to `main`.** Every change goes through a pull request.
2. **Never merge your own PR.** The other member reviews, leaves at least one real comment or
   approval note, and merges with **Create a merge commit**.
3. **One WP = one branch = one PR.** Don't start a WP whose **Needs** (in `docs/progress.json`) are
   not merged yet.
4. **Commit locally at each working step** (usually 4–10 commits per WP), push once at the end.
   A draft PR halfway is fine for early feedback.
5. Commit with **your own name and email** on **your own laptop**.

## One-time setup (WP-00)

Done by the repo owner (Huzaifah) unless noted:

1. Create the repository — ✅ `mythical-invader/Pocket-Prune` (private).
2. **Add Sibghatullah as collaborator:** Settings → Collaborators → Add people → his GitHub username.
   He accepts the email invitation.
3. Labels — ✅ `backend`, `worker`, `frontend`, `mobile`, `docs`, `test`, `bug`, `phase-1` … `phase-5`.
4. Milestones — ✅ `M1 Setup + First Compression`, `M2 Website Job End-to-End`,
   `M3 Metrics + Recommender`, `M4 Complete Product`, `M5 Final`.
5. One issue per WP — ✅ (assignee = owner, label, milestone).
6. **Protect `main`:** Settings → Branches → Add branch ruleset (or "Add rule") for `main`:
   - Require a pull request before merging, **1 approval**
   - Require status checks to pass → select **CI / check**
   - Block force pushes
   > Branch protection on a **private** repo needs GitHub Pro — free with the
   > [GitHub Student Developer Pack](https://education.github.com/pack). Without it, follow the rules
   > above by hand.
7. Settings → General → Pull Requests: keep **Allow merge commits** ticked (branches stay visible in
   the history). Untick squash/rebase if you want to make it the only option.
8. **Each member, once per laptop:**
   ```bash
   git config --global user.name "Your Real Name"
   git config --global user.email "the-email-on-your-github-account"
   ```
9. Shared database: one member creates a free **MongoDB Atlas M0** cluster, adds both as database
   users, allows both IPs (Network Access), and shares the connection string privately (not in
   Git). Both put it in `.env` as `MONGO_URI`.

## Every work package

**▶ START**

```bash
git checkout main
git pull
git checkout -b feat/wp03-backend-core      # branch name from the WP table
```

On GitHub, move the WP's issue to _In progress_ (or comment "Starting").

**▶ CHECKPOINT** (a part works, tests pass)

```bash
git add .
git status          # check: no .env, no data/, no model files
git commit -m "feat(api): add Mongoose models (#4)"
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `style`.

**▶ END**

```bash
npm test
git push -u origin feat/wp03-backend-core
```

Open the PR (GitHub "Compare & pull request" or `gh pr create --base main`), fill the template,
write `Closes #<issue>`, set reviewer = the other member, label + milestone. Then ask the other
member to review and merge with **Create a merge commit**.

**▶ AFTER MERGE**

```bash
git checkout main
git pull
git branch -d feat/wp03-backend-core
```

Set the WP to `merged` in `docs/progress.json` in your next branch and run `npm run progress`.

**▶ MILESTONE** (after its last PR merges)

```bash
git checkout main
git pull
git tag -a v0.1.0-M1 -m "M1: setup + first compression"
git push origin v0.1.0-M1
```

Then create a GitHub Release from `docs/release-notes/M1.md` and close the milestone.

## Reviewing a teammate's PR

1. Open the PR → **Files changed**. Read every file; it should make sense to you.
2. Pull it and try it if it changes behaviour:
   ```bash
   git fetch
   git checkout <their-branch>
   npm run install-all
   npm test
   ```
3. Leave at least one real comment (a question, a suggestion, or what you checked).
4. **Review changes → Approve** (or Request changes).
5. When CI is green: **Merge pull request → Create a merge commit**. Delete the branch.

## Common problems

| Problem                       | Fix                                                                        |
| ----------------------------- | -------------------------------------------------------------------------- |
| `git push` rejected on `main` | You're on `main`. `git checkout -b <branch>` then push the branch.         |
| Accidentally committed `.env` | `git rm --cached .env`, commit, and **change the leaked passwords**.       |
| Branch is behind `main`       | `git checkout main && git pull && git checkout <branch> && git merge main` |
| Wrong author on commits       | Fix `git config user.name/user.email` before the next commit.              |
