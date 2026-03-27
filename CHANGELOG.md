# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2025-12-01

### Added
- **Bronze Layer**: Excel/CSV ingestion via Polars + PyArrow into PostgreSQL
- **Silver Layer**: dbt staging models with cleaning, deduplication, and normalization
- **Gold Layer**: Star schema with 6 dimensions, 1 fact table, 8 aggregation models
- **FastAPI API**: 10 analytics endpoints with parameterized SQL queries
- **Next.js Dashboard**: 6 pages (overview, products, customers, staff, sites, returns)
- **Power BI**: 99 DAX measures with calculation groups
- **Security**: Tenant-scoped RLS, SQL injection prevention, CORS configuration
- **Testing**: 95%+ Python coverage, 17 Playwright E2E specs
- **Docker**: 5-service compose setup (app, api, postgres, pgadmin, frontend)
- **Migrations**: 4 SQL migrations with schema versioning
