# 🛡 GitHub Actions — Regression Shield

## What's in this folder

### `regression_shield.yml`

Runs the regression shield on every push + PR to `main` / `master` / `develop`.
Blocks broken code from merging.

**Triggers:**
- Any `push` to main/master/develop
- Any `pull_request` targeting those branches
- Manual run from the Actions tab (`workflow_dispatch`)

**What it does:**
1. Installs Python 3.11 + backend deps
2. Runs `/app/backend/tests/regression_shield.py` (19 test cases)
3. Installs Node 18 + frontend deps
4. Runs `tsc --noEmit --skipLibCheck` on frontend
5. Fails if TypeScript error count exceeds 150 (baseline ~100 pre-existing)

**Runtime:** ~4 minutes per run (pip + yarn install cached via actions/setup-*).

---

## How to enforce it (one-time setup in GitHub)

After you push this repo to GitHub:

1. Go to **GitHub → your repo → Settings → Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main` (and/or `master` / `develop`)
4. ✅ Check **"Require a pull request before merging"**
5. ✅ Check **"Require status checks to pass before merging"**
6. In the search box under that, search for `🛡 Backend shield + TS baseline` and tick it
7. ✅ Check **"Require branches to be up to date before merging"**
8. Click **Create / Save**

After this, nobody (including you or any AI agent) can merge a PR that breaks
the shield. This is the whack-a-mole killer.

---

## Local equivalent

Run the exact same checks locally before pushing:

```bash
/app/scripts/run_shield.sh
```

If local shield is green, the GitHub Action will also be green.
