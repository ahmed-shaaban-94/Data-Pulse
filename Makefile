.PHONY: up down build test lint fmt dbt logs clean

## Docker
up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

## Testing
test:
	docker exec -it datapulse-app pytest --cov=datapulse --cov-report=term-missing

test-e2e:
	docker compose exec frontend npx playwright test

## Linting
lint:
	docker exec -it datapulse-app ruff check src/ tests/

fmt:
	docker exec -it datapulse-app ruff format src/ tests/

## dbt
dbt:
	docker exec -it datapulse-app dbt build --project-dir /app/dbt

dbt-test:
	docker exec -it datapulse-app dbt test --project-dir /app/dbt

## Data
load:
	docker exec -it datapulse-app python -m datapulse.bronze.loader --source /app/data/raw/sales

## Cleanup
clean:
	docker compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
