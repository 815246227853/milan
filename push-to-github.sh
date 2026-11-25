#!/usr/bin/env bash
set -e

USER="${1:?Usage: bash push-to-github.sh YOUR_GITHUB_USERNAME}"
REPO="${2:-milan}"

git init -b main
git add .
git diff --cached --quiet || git commit -m "Milan: README, repo structure, landing page and wireframes"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/$USER/$REPO.git"
fi

git push -u origin main
echo "Done: https://github.com/$USER/$REPO"
