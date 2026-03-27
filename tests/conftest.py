"""Session-scoped test configuration for DataPulse.

Problem: The project's .env file contains extra keys (POSTGRES_USER,
POSTGRES_PASSWORD, POSTGRES_DB, PGADMIN_EMAIL, PGADMIN_PASSWORD) that
pydantic-settings rejects as "extra_forbidden" when Settings() is called.

Solution: Patch get_settings() at the session level so every call to
get_settings() in production code returns a clean Settings instance built
from defaults only (no .env file). Tests that need a custom Settings object
patch get_settings() locally within the test.
"""

from unittest.mock import patch

import pytest

from datapulse.config import Settings, get_settings


@pytest.fixture(autouse=True, scope="session")
def _patch_get_settings_globally():
    """Replace get_settings() with a version that never reads the .env file.

    This is session-scoped so it runs once and covers all tests, including
    the pre-existing tests in test_reader.py that call read_file() which
    internally calls get_settings().

    Individual tests that need custom settings values patch get_settings()
    locally — those local patches take precedence over this session patch.
    """
    # Build a clean Settings instance without touching the project's .env
    clean_settings = Settings(_env_file=None)
    get_settings.cache_clear()

    with patch(
        "datapulse.config.get_settings",
        return_value=clean_settings,
    ):
        # Also patch the imported references in each module that uses get_settings
        with patch(
            "datapulse.import_pipeline.validator.get_settings",
            return_value=clean_settings,
        ):
            with patch(
                "datapulse.import_pipeline.reader.get_settings",
                return_value=clean_settings,
            ):
                with patch(
                    "datapulse.bronze.loader.get_settings",
                    return_value=clean_settings,
                ):
                    yield

    get_settings.cache_clear()
