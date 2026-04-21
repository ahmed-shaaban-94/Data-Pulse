"""CI guard: block PRs that introduce duplicate migration numbers.

Every file in ``migrations/`` is identified by the token before its first
underscore: ``031_pipeline_last_completed_stage.sql`` has key ``031``,
``030a_bronze_sales_unique_index.sql`` has key ``030a``. Two files sharing
a key are duplicates — a numbered-migration runner that keys off the
leading prefix can silently skip one. See issue #538.

Letter suffixes (``030a``, ``030b``, ``071b``) are a valid sub-slot
convention in this repo: they allow adding a follow-up change that must
apply in a specific ordinal position. They are NOT duplicates of their
base number (``030`` and ``030a`` are distinct slots).

Exit codes:
    0 — all migration prefixes are unique and well-formed
    1 — one or more duplicates or malformed filenames

Run locally:
    python scripts/check_migration_numbers.py
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
# Accept NNN_* (strict numeric) and NNN<letter>_* (sub-slot variant).
_FILE_RE = re.compile(r"^(?P<prefix>\d{3}[a-z]?)_(?P<slug>[a-z0-9_]+)\.sql$")


def collect_migrations(directory: Path) -> tuple[dict[str, list[str]], list[str]]:
    """Return (files-by-prefix, malformed-filenames)."""
    by_prefix: dict[str, list[str]] = defaultdict(list)
    malformed: list[str] = []
    for entry in sorted(directory.iterdir()):
        if not entry.is_file() or entry.suffix != ".sql":
            continue
        match = _FILE_RE.match(entry.name)
        if not match:
            malformed.append(entry.name)
            continue
        by_prefix[match["prefix"]].append(entry.name)
    return by_prefix, malformed


def find_problems(by_prefix: dict[str, list[str]], malformed: list[str]) -> list[str]:
    """Return human-readable problems. Empty list = all clean."""
    problems: list[str] = []

    for name in malformed:
        problems.append(
            f"Malformed migration filename {name!r}: "
            "expected pattern NNN_desc.sql or NNN<letter>_desc.sql "
            "(lowercase letters, digits, underscores only)"
        )

    for prefix in sorted(by_prefix):
        files = by_prefix[prefix]
        if len(files) > 1:
            problems.append(f"Duplicate migration prefix {prefix!r}: {', '.join(files)}")

    return problems


def main() -> int:
    if not MIGRATIONS_DIR.is_dir():
        print(f"ERROR: migrations directory not found at {MIGRATIONS_DIR}", file=sys.stderr)
        return 1

    by_prefix, malformed = collect_migrations(MIGRATIONS_DIR)
    problems = find_problems(by_prefix, malformed)

    if problems:
        print(f"Migration integrity check FAILED ({len(problems)} problem(s)):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print(
            "\nSee docs/RUNBOOK.md section 3 for the duplicate-prefix "
            "reconciliation procedure (issue #538).",
            file=sys.stderr,
        )
        return 1

    total = sum(len(files) for files in by_prefix.values())
    print(f"Migration integrity check PASSED: {total} files, no duplicate prefixes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
