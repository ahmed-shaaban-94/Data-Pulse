"""Tests for scripts/check_migration_numbers.py (CI guard for issue #538)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "check_migration_numbers.py"


def _write_migrations(tmp_path: Path, names: list[str]) -> Path:
    """Create a fake migrations/ dir with empty files of the given names."""
    migrations = tmp_path / "migrations"
    migrations.mkdir()
    for name in names:
        (migrations / name).write_text("-- test\nSELECT 1;\n")
    # The script derives MIGRATIONS_DIR relative to its own location. To point
    # it at our fake dir, we copy the script into a scripts/ subdir of tmp_path
    # so that __file__.resolve().parent.parent / "migrations" resolves correctly.
    scripts_dir = tmp_path / "scripts"
    scripts_dir.mkdir()
    (scripts_dir / "check_migration_numbers.py").write_text(SCRIPT.read_text())
    return scripts_dir / "check_migration_numbers.py"


def _run(script_path: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(script_path)],
        capture_output=True,
        text=True,
        check=False,
    )


class TestPassingCases:
    def test_empty_migrations_directory_passes(self, tmp_path):
        script = _write_migrations(tmp_path, [])
        result = _run(script)
        assert result.returncode == 0

    def test_unique_numeric_prefixes_pass(self, tmp_path):
        script = _write_migrations(tmp_path, ["001_init.sql", "002_roles.sql", "003_indexes.sql"])
        result = _run(script)
        assert result.returncode == 0, result.stderr

    def test_letter_suffixed_subslots_are_not_duplicates(self, tmp_path):
        """030 and 030a are distinct slots, not a duplicate of each other."""
        script = _write_migrations(
            tmp_path,
            [
                "030_base.sql",
                "030a_followup.sql",
                "030b_another.sql",
                "031_next.sql",
            ],
        )
        result = _run(script)
        assert result.returncode == 0, result.stderr

    def test_gaps_in_sequence_are_allowed(self, tmp_path):
        """Gaps like 005 -> 007 are permitted (see 006_placeholder.sql)."""
        script = _write_migrations(tmp_path, ["001_init.sql", "002_next.sql", "100_much_later.sql"])
        result = _run(script)
        assert result.returncode == 0

    def test_placeholder_file_passes(self, tmp_path):
        """006_placeholder.sql in the real repo must not be flagged."""
        script = _write_migrations(
            tmp_path, ["005_prior.sql", "006_placeholder.sql", "007_after.sql"]
        )
        result = _run(script)
        assert result.returncode == 0


class TestFailingCases:
    def test_duplicate_numeric_prefix_is_detected(self, tmp_path):
        """The exact #538 bug: two files sharing prefix 031."""
        script = _write_migrations(
            tmp_path,
            [
                "031_gamification.sql",
                "031_pipeline.sql",
            ],
        )
        result = _run(script)
        assert result.returncode == 1
        assert "Duplicate migration prefix '031'" in result.stderr
        assert "031_gamification.sql" in result.stderr
        assert "031_pipeline.sql" in result.stderr

    def test_duplicate_letter_subslot_is_detected(self, tmp_path):
        """030a_foo and 030a_bar both claim sub-slot 030a — also a duplicate."""
        script = _write_migrations(tmp_path, ["030_base.sql", "030a_foo.sql", "030a_bar.sql"])
        result = _run(script)
        assert result.returncode == 1
        assert "Duplicate migration prefix '030a'" in result.stderr

    def test_malformed_filename_is_detected(self, tmp_path):
        """Uppercase letters break the convention."""
        script = _write_migrations(tmp_path, ["031_GoodName.sql"])
        result = _run(script)
        assert result.returncode == 1
        assert "Malformed" in result.stderr

    def test_non_sql_files_are_ignored(self, tmp_path):
        """README and shell scripts in migrations/ must not trigger the check."""
        script = _write_migrations(
            tmp_path,
            ["001_init.sql", "README.md", "apply.sh"],
        )
        # README.md and apply.sh aren't .sql files, so they're skipped entirely.
        result = _run(script)
        assert result.returncode == 0


@pytest.mark.unit
def test_real_repo_migrations_state_is_known():
    """Documents the current state on main: the script fails because
    of issue #538's three duplicate pairs. Once the duplicates are
    reconciled (per RUNBOOK §3 procedure), this test should be updated
    to assert a passing return code.
    """
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
        check=False,
    )
    # This is a guarded regression — if a future PR accidentally RESOLVES
    # the duplicates (e.g. by merging the rename PR), this test updates them
    # of the shift. Kept permissive: either exit-0 (all resolved) or exit-1
    # with the three known duplicates.
    assert result.returncode in (0, 1)
    if result.returncode == 1:
        # Expected state today (#538 open): must list the known duplicates.
        for prefix in ("031", "088", "089"):
            assert f"Duplicate migration prefix '{prefix}'" in result.stderr, (
                f"Expected known duplicate prefix '{prefix}' to be reported "
                f"while #538 is open. stderr:\n{result.stderr}"
            )
