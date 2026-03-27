# Contributing to DataPulse

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/ahmed-shaaban-94/SAAS.git
cd SAAS

# Copy environment file
cp .env.example .env

# Start all services
docker compose up -d --build
```

## Code Standards

### Python
- Python 3.11+
- Linting: `ruff check src/ tests/`
- Formatting: `ruff format src/ tests/`
- Type hints on all public functions
- Line length: 100 characters

### Frontend
- TypeScript strict mode
- ESLint + Prettier via Next.js defaults

### Testing
- Backend: `pytest --cov`
- Frontend E2E: `docker compose exec frontend npx playwright test`
- Minimum coverage: 80%

## Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feat/<description>` | `feat/add-export-csv` |
| Bug fix | `fix/<description>` | `fix/chart-tooltip-overlap` |
| Refactor | `refactor/<description>` | `refactor/split-loader` |
| Docs | `docs/<description>` | `docs/update-readme` |

## Pull Request Process

1. Create a branch from `main`
2. Make your changes
3. Ensure linting and tests pass
4. Submit a PR with a clear description
5. Wait for review

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add CSV export to dashboard
fix: correct date filter timezone offset
refactor: split bronze loader into smaller modules
docs: update API endpoint documentation
test: add missing repository edge cases
```
