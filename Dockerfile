# supercronic, checked against its release checksum. One stage per CPU
# architecture, because each binary has its own checksum; only the one matching
# the build runs. To upgrade, change the version and checksum in both.
FROM scratch AS supercronic-amd64
ADD --checksum=sha256:a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1 \
    https://github.com/aptible/supercronic/releases/download/v0.2.49/supercronic-linux-amd64 /supercronic

FROM scratch AS supercronic-arm64
ADD --checksum=sha256:02aa0cb229ba09050cba6638059dadb9eedc2276632ea43d6a57a2f8c1629dd5 \
    https://github.com/aptible/supercronic/releases/download/v0.2.49/supercronic-linux-arm64 /supercronic

FROM supercronic-${TARGETARCH} AS supercronic

# Stage 1: Builder
FROM python:3.14.8-slim AS builder

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
FROM python:3.14.8-slim

COPY --from=supercronic --chmod=755 /supercronic /usr/local/bin/supercronic

# Create non root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m appuser

WORKDIR /app

# Copy the application code and .venv from the builder
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