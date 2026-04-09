"""Tests for upload service UUID validation (path traversal prevention)."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from datapulse.upload.service import UploadService


@pytest.fixture()
def service(tmp_path):
    """Return an UploadService with a temp raw data dir and mocked TEMP_DIR."""
    with patch("datapulse.upload.service.TEMP_DIR", tmp_path):
        yield UploadService(raw_data_dir=str(tmp_path / "raw"))


# ---------------------------------------------------------------------------
# preview_file — UUID validation
# ---------------------------------------------------------------------------


def test_preview_file_path_traversal_rejected(service):
    """Path traversal sequences in file_id must return HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        service.preview_file("../../../etc/passwd")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file ID format"


def test_preview_file_glob_wildcard_rejected(service):
    """Glob wildcard characters in file_id must return HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        service.preview_file("*")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file ID format"


def test_preview_file_valid_uuid_no_file_raises_not_found(service):
    """A valid UUID that has no corresponding file raises FileNotFoundError."""
    valid_id = str(uuid.uuid4())
    with pytest.raises(FileNotFoundError):
        service.preview_file(valid_id)


# ---------------------------------------------------------------------------
# confirm_upload — UUID validation
# ---------------------------------------------------------------------------


def test_confirm_upload_path_traversal_rejected(service):
    """Path traversal sequences in file_ids must return HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        service.confirm_upload(["../../../etc/passwd"])
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file ID format"


def test_confirm_upload_glob_wildcard_rejected(service):
    """Glob wildcard characters in file_ids must return HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        service.confirm_upload(["*"])
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file ID format"


def test_confirm_upload_valid_uuid_no_file_returns_empty(service):
    """A valid UUID with no matching temp file is silently skipped (returns empty list)."""
    valid_id = str(uuid.uuid4())
    result = service.confirm_upload([valid_id])
    assert result == []


# ---------------------------------------------------------------------------
# Additional edge cases
# ---------------------------------------------------------------------------


def test_preview_file_empty_string_rejected(service):
    """Empty string for file_id must be rejected as invalid UUID."""
    with pytest.raises(HTTPException) as exc_info:
        service.preview_file("")
    assert exc_info.value.status_code == 400


def test_preview_file_arbitrary_string_rejected(service):
    """Arbitrary non-UUID string must be rejected."""
    with pytest.raises(HTTPException) as exc_info:
        service.preview_file("notauuid")
    assert exc_info.value.status_code == 400


def test_confirm_upload_mixed_ids_rejects_on_first_invalid(service):
    """If any file_id is invalid, HTTP 400 is raised immediately."""
    valid_id = str(uuid.uuid4())
    with pytest.raises(HTTPException) as exc_info:
        service.confirm_upload([valid_id, "../traversal"])
    assert exc_info.value.status_code == 400


def test_preview_file_brace_form_uuid_normalized_not_injected(service):
    """Brace-form UUID is normalized by uuid.UUID() — braces never reach the glob.

    Python's uuid.UUID() accepts ``{uuid}`` form and returns the canonical
    hyphenated string (no braces), so ``str(uuid.UUID(...))`` strips the
    braces before they can be used in a glob pattern.  The service must
    therefore NOT raise HTTPException(400) for this input; it should raise
    FileNotFoundError because no matching file exists, confirming that the
    normalized (safe) form was used in the glob call.
    """
    brace_form_id = "{12345678-1234-5678-1234-567812345678}"
    # Must NOT raise HTTPException — UUID is valid, just non-standard form
    with pytest.raises(FileNotFoundError):
        service.preview_file(brace_form_id)
