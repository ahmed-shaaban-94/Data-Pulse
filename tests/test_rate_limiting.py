"""Verify rate limiting is applied at the API level."""

import pytest
from fastapi.testclient import TestClient

from datapulse.api.app import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_rate_limiter_is_configured(client):
    """The API has a rate limiter attached."""
    app = client.app
    assert hasattr(app.state, "limiter")
    assert app.state.limiter is not None


def test_rate_limit_default_is_sixty_per_minute():
    """Default rate limit is 60/minute."""
    from datapulse.api.limiter import limiter

    # _default_limits is a list of LimitGroup objects.
    # LimitGroup stores the raw string in the name-mangled attribute
    # _LimitGroup__limit_provider, and is also iterable yielding Limit objects
    # whose .limit attribute is a RateLimitItem.
    assert len(limiter._default_limits) > 0
    limit_group = limiter._default_limits[0]

    # Verify via the private provider string stored on the LimitGroup
    provider = limit_group.__dict__.get("_LimitGroup__limit_provider", "")
    assert "60" in str(provider) and "minute" in str(provider)
