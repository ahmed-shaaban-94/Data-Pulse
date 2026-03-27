# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in DataPulse, please report it responsibly.

**Email**: ahmed.shaaban.94@outlook.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 48 hours and work with you to resolve the issue.

## Security Measures

- All credentials managed via `.env` (never hardcoded)
- Docker ports bound to `127.0.0.1` only
- Tenant-scoped Row Level Security (RLS) on all data layers
- SQL column whitelist before INSERT (prevents injection)
- Financial columns use `NUMERIC(18,4)` (not floating-point)
- CORS origins configurable via environment variables
- Global exception handler returns generic 500 (no stack traces to clients)
- Health endpoint returns 503 when DB is unreachable
