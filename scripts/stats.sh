#!/bin/bash
# Repo stats for the README — run from the repo root.
cd "$(dirname "$0")/.." || exit 1
LINES=$(find app/src packages/*/src supabase/functions -name '*.ts' -o -name '*.tsx' 2>/dev/null | grep -v node_modules | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
TESTS=$(grep -rE "^\s*(it|test)\(" app/src packages/*/src --include='*.test.ts' --include='*.test.tsx' 2>/dev/null | wc -l | tr -d ' ')
COMMITS=$(git rev-list --count HEAD)
DAYS=$(git log --format='%ad' --date=short | sort -u | wc -l | tr -d ' ')
echo "date: $(date +%Y-%m-%d)"
echo "lines: $LINES"
echo "tests: ~$TESTS (it/test blocks; some are it.each over 11 themes)"
echo "commits: $COMMITS"
echo "active days: $DAYS"
