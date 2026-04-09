# tests/test_csp_headers.py
"""Validate that CSP headers block unsafe script execution."""

import pytest
from fastapi.testclient import TestClient

from datapulse.api.app import create_app


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_security_headers_present(client):
    """API responses include standard security headers."""
    resp = client.get("/health/live")
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_no_unsafe_eval_in_api_csp(client):
    """API CSP must never contain unsafe-eval."""
    resp = client.get("/health/live")
    csp = resp.headers.get("content-security-policy", "")
    # API-level CSP may or may not be present (Nginx adds it),
    # but if it IS present, it must not have unsafe-eval
    if csp:
        assert "unsafe-eval" not in csp
