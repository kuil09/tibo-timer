#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Keep publication explicit; this command never commits or pushes.
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  echo 'This entry point is for local collection only.' >&2
  exit 1
fi
node --import tsx src/sync.ts
npm run build
