#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${1:-main}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before sync."
  exit 1
fi

git fetch origin --prune

git checkout "$TARGET_BRANCH"
git pull --ff-only origin "$TARGET_BRANCH"

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "origin/${TARGET_BRANCH}")"

if [[ "$local_sha" == "$remote_sha" ]]; then
  echo "Workspace synced: ${TARGET_BRANCH} @ ${local_sha}"
else
  echo "Sync mismatch: local=${local_sha} remote=${remote_sha}"
  exit 1
fi

echo "Previous branch: ${current_branch}"
