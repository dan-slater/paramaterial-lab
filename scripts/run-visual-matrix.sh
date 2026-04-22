#!/usr/bin/env bash
# Orchestrator: build → run matrix → open output dir in Finder.
#
# nginx is assumed to serve `web/build/` on http://localhost:8080 (see README).
# This script does not touch nginx; it only rebuilds the static bundle so the
# matrix can exercise the latest source.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

echo "[1/3] build"
( cd "$ROOT" && npm run build )

echo "[2/3] visual-matrix"
node "$HERE/visual-matrix.mjs"

echo "[3/3] open report dir"
if command -v open >/dev/null 2>&1; then
  open ../tmp/visual-matrix-screenshots || true
fi
