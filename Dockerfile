# Stage 1: Builder
FROM python:3.14-slim AS builder

# Install uv
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#installing-uv
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

# Compile bytecode
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#compiling-bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#caching
ENV UV_LINK_MODE=copy

WORKDIR /app

# Install dependencies first to maximize Docker caching
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# 2. Copy the application code and install the project
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Stage 2: Runner
FROM python:3.14-slim

# Install supercronic
ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.49
ADD --chmod=755 https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH} /usr/local/bin/supercronic

# Create non root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m appuser

WORKDIR /app

# Copy the application code and .venv from the builder
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app /app

# Set the virtual environment at the front of the PATH
ENV PATH="/app/.venv/bin:$PATH"

# Write output straight to docker logs, so console lines arrive on time and a
# killed process doesn't lose what it buffered
ENV PYTHONUNBUFFERED=1

# Trust proxy headers only from this address; override at deploy with the
# real load balancer address
ENV FORWARDED_ALLOW_IPS=127.0.0.1

# Switch to the non-root user
USER appuser

CMD ["fastapi", "run", "--workers", "4", "src/main.py"]