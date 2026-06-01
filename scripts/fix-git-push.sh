#!/usr/bin/env bash
# Removes node_modules from git history so GitHub push succeeds.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Removing node_modules from git index..."
git rm -r --cached node_modules 2>/dev/null || true
git rm --cached tsconfig.tsbuildinfo 2>/dev/null || true

echo "==> Adding .gitignore..."
git add .gitignore

echo "==> Rewriting last commit without node_modules..."
git commit --amend -m "$(cat <<'EOF'
Integrate Hermes Agent into CompliScore for challenge submission.

Replace the one-shot Groq summary with a plan→tool→report agent loop,
add agent trace UI, Groq/static fallback, production deploy docs, and tests.
EOF
)"

echo "==> Verifying node_modules is not tracked..."
if git ls-files | grep -q '^node_modules/'; then
  echo "ERROR: node_modules still tracked. Contact support."
  exit 1
fi

echo "==> Done. Push with:"
echo "    git push origin main"
