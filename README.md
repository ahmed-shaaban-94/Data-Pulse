<p align="center">
  <h1 align="center">DataPulse</h1>
  <p align="center">Sales Analytics Platform — Import, Clean, Analyze, Visualize</p>
</p>

<p align="center">
  <a href="https://github.com/ahmed-shaaban-94/SAAS/actions/workflows/ci.yml"><img src="https://github.com/ahmed-shaaban-94/SAAS/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/ahmed-shaaban-94/SAAS/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/python-3.12-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/postgresql-16-blue.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/next.js-14-black.svg" alt="Next.js">
  <img src="https://img.shields.io/badge/dbt-1.8-orange.svg" alt="dbt">
  <img src="https://img.shields.io/badge/coverage-95%25-brightgreen.svg" alt="Coverage">
</p>

---

DataPulse is a data analytics platform built on a **medallion architecture** (Bronze / Silver / Gold) for processing and analyzing sales data. It ingests raw Excel files, transforms them through a structured pipeline, and serves business-ready metrics via a REST API and interactive dashboard.

## Architecture

```
Excel/CSV Files (12 quarterly, 272 MB)
         |
    Polars + PyArrow
         |
    +----+----+
    |         |
    v         v
 Parquet   PostgreSQL 16
 (57 MB)   bronze.sales (1.1M rows)
              |
         dbt transforms
              |
     +--------+--------+
     |                  |
     v                  v
  Silver             Gold
  (cleaned)          (aggregated)
     |                  |
     |         +--------+--------+
     |         |        |        |
     |         v        v        v
     |      FastAPI  Next.js  Power BI
     |      REST API Dashboard 99 DAX measures
     |         |        |
     +----+----+--------+
          |
       Analytics
```

## Quick Start

### Prerequisites

- Docker Desktop
- Git

### Setup

```bash
git clone https://github.com/ahmed-shaaban-94/SAAS.git
cd SAAS
cp .env.example .env
docker compose up -d --build
```

### Services

| Service | URL | Purpose |
|---------|-----|---------|
| **API** | `localhost:8000` | FastAPI analytics API |
| **Dashboard** | `localhost:3000` | Next.js interactive dashboard |
| **PostgreSQL** | `localhost:5432` | Database |
| **pgAdmin** | `localhost:5050` | Database admin UI |
| **JupyterLab** | `localhost:8888` | Notebooks |

### Load Sales Data

```bash
docker exec -it datapulse-app python -m datapulse.bronze.loader --source /app/data/raw/sales
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Processing | Polars + PyArrow + fastexcel |
| Database | PostgreSQL 16 |
| Data Transforms | dbt-core + dbt-postgres |
| API | FastAPI + SQLAlchemy 2.0 |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Charts | Recharts |
| BI | Power BI Desktop (99 DAX measures) |
| Config | Pydantic Settings |
| Logging | structlog |
| Containers | Docker Compose (5 services) |
| Testing | pytest (95%+ coverage) + Playwright E2E |

## Project Structure

```
src/datapulse/
├── config.py                # Pydantic settings
├── logging.py               # structlog configuration
├── bronze/                  # Raw data ingestion (Excel -> Parquet -> PostgreSQL)
├── import_pipeline/         # Generic CSV/Excel reader + type detection
├── analytics/               # Business logic (models, repository, service)
└── api/                     # FastAPI REST API (10 endpoints)

dbt/models/
├── bronze/                  # Source definitions
├── staging/                 # Silver layer (cleaned, 35 cols, 7 tests)
└── marts/                   # Gold layer
    ├── dims/                # 6 dimension tables
    ├── facts/               # Fact table (1.1M rows, 6 FKs)
    └── aggs/                # 8 aggregation tables + metrics

frontend/src/
├── app/                     # 6 pages (dashboard, products, customers, staff, sites, returns)
├── components/              # Reusable UI components
├── hooks/                   # 9 SWR data hooks
└── lib/                     # API client, formatters, utilities
```

## Data

- **Source**: 12 quarterly Excel files (Q1 2023 — Q4 2025)
- **Volume**: 1,134,799 sales transactions, 46 columns
- **Raw size**: 272 MB (Excel) → 57 MB (Parquet)
- **Dimensions**: Product, Customer, Site, Staff, Billing, Date

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1.1 Foundation | Done | Docker, Python env, import pipeline |
| 1.2 Bronze Layer | Done | 1.1M rows loaded into PostgreSQL |
| 1.3 Silver Layer | Done | Cleaned, normalized, deduplicated, 7 dbt tests |
| 1.4 Gold Layer | Done | Star schema, 6 dims + 1 fact + 8 aggregations, FastAPI API |
| 1.5 Dashboard | Done | Next.js 14, 6 pages, Recharts, SWR, Playwright E2E |
| 2.0 Automation | Next | n8n workflow automation |
| 3.0 AI Analysis | Planned | LangGraph AI-powered insights |
| 4.0 Public Site | Planned | Landing page and website |

## Development

```bash
# Run tests
make test

# Lint
make lint

# Run dbt
make dbt

# Start all services
make up
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full development guide.

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE) for details.

---

<sub>See [CLAUDE.md](./CLAUDE.md) for full technical reference · See [PLAN.md](./PLAN.md) for detailed phase breakdown</sub>
