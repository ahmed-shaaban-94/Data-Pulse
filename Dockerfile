FROM python:3.12-slim-bookworm

WORKDIR /app

# git needed for dbt package resolution
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip to fix known CVEs
RUN pip install --no-cache-dir --upgrade pip

# Copy project files and install (runtime deps only, no dev tools)
COPY pyproject.toml .
COPY src/ src/

RUN pip install --no-cache-dir -e "." jupyterlab

RUN useradd -m -u 1000 appuser
USER appuser

EXPOSE 8888

# Default command: keep container running for interactive use
CMD ["tail", "-f", "/dev/null"]
