#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

chmod +x .githooks/pre-push

git config core.hooksPath .githooks
git config pull.ff only

echo "Sync guards installed."
echo "- hooksPath: $(git config --get core.hooksPath)"
echo "- pull.ff: $(git config --get pull.ff)"
echo "Use 'npm run sync:workspace' before starting work on main."
