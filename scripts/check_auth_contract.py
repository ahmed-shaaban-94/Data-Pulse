"""Guard the Auth0-only runtime contract for issue #654.

Uses stdlib only so it can run early in CI before Python/Node deps install.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> int:
    failures: list[str] = []

    package_json = json.loads(_read_text(ROOT / "frontend" / "package.json"))
    dependencies = package_json.get("dependencies", {})
    if "@clerk/nextjs" in dependencies:
        failures.append("frontend/package.json still depends on @clerk/nextjs")

    banned_tokens: dict[Path, list[str]] = {
        ROOT / ".env.example": ["AUTH_PROVIDER=", "CLERK_"],
        ROOT / "frontend" / ".env.example": ["NEXT_PUBLIC_AUTH_PROVIDER", "CLERK_"],
        ROOT / "frontend" / "src" / "lib" / "auth-bridge.tsx": [
            "@clerk/nextjs",
            "NEXT_PUBLIC_AUTH_PROVIDER",
        ],
        ROOT / "frontend" / "src" / "middleware.ts": [
            "@clerk/nextjs",
            "clerkMiddleware",
            "NEXT_PUBLIC_AUTH_PROVIDER",
        ],
        ROOT / "src" / "datapulse" / "core" / "config.py": [
            'Literal["auth0", "clerk"]',
            'auth_provider == "clerk"',
        ],
        ROOT / "src" / "datapulse" / "core" / "jwt.py": [
            "active_jwks_url",
            "active_issuer_url",
            "active_audience",
            "active_expected_azp",
        ],
    }

    required_tokens: dict[Path, list[str]] = {
        ROOT / "src" / "datapulse" / "core" / "config.py": ['Literal["auth0"]'],
    }

    for path, tokens in banned_tokens.items():
        text = _read_text(path)
        for token in tokens:
            if token in text:
                failures.append(f"{path.relative_to(ROOT)} contains banned token: {token}")

    for path, tokens in required_tokens.items():
        text = _read_text(path)
        for token in tokens:
            if token not in text:
                failures.append(f"{path.relative_to(ROOT)} is missing required token: {token}")

    if failures:
        print("Auth contract check failed:", file=sys.stderr)
        for failure in failures:
            print(f" - {failure}", file=sys.stderr)
        return 1

    print("Auth contract check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
