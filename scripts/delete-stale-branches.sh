#!/usr/bin/env bash
# Delete all remote branches except main
# Run this locally with proper GitHub credentials:
#   chmod +x scripts/delete-stale-branches.sh && ./scripts/delete-stale-branches.sh

set -euo pipefail

REPO="ahmed-shaaban-94/Data-Pulse"
PROTECTED="main"

echo "Fetching all remote branches for $REPO..."
branches=$(git ls-remote --heads origin | awk '{print $2}' | sed 's|refs/heads/||')

count=0
for branch in $branches; do
  if [ "$branch" = "$PROTECTED" ]; then
    echo "  [SKIP] $branch (protected)"
    continue
  fi
  echo "  [DELETE] $branch"
  git push origin --delete "$branch" || echo "  [WARN] Failed to delete $branch"
  count=$((count + 1))
done

echo ""
echo "Done. Deleted $count branches (kept: $PROTECTED)."
