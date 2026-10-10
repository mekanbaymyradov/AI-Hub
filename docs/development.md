# Development guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose
- [uv](https://docs.astral.sh/uv/). It installs Python 3.14 itself.

## Configure `.env`

```bash
cp .env.example .env
```

Empty values count as missing, so the app won't start until these are filled.
Everything else has a working default.

| Variable | Why |
|---|---|
| `JWT_SECRET` | Signs access tokens. Any random value of 32+ bytes: `openssl rand -hex 32` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sign-in codes are emailed, so you can't sign in without them. Resend's test sender `onboarding@resend.dev` works without a domain, but only delivers to your own Resend account email. |
| `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | Cloudflare R2 or any S3-compatible store, with two buckets: `S3_PUBLIC_BUCKET` for avatars, served over `S3_PUBLIC_BASE_URL`, and `S3_PRIVATE_BUCKET` for attachments, with public access off |
| At least one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY` | Providers without a key are left out of the model list |

Optional: set `LOGFIRE_TOKEN` to a write token from your Logfire project. The
`app` and `scheduler` containers then send traces tagged `environment=local`,
with full LLM prompts and replies. Without it, they only print to the console.

## Run

```bash
docker compose -f docker-compose.dev.yaml up --watch
```

This starts four services:

- `app`: the API on http://localhost:8000. It reloads when files in `src/` change.
- `postgres`
- `redis`
- `scheduler`: runs the cron jobs

## Migrations

Run Alembic from your machine, not inside the `app` container, for two reasons:

- The image is built without dev dependencies, so it lacks ruff, which the
  hooks in `alembic.ini` run on every new revision.
- The container only syncs `src/`, so it never sees new migration files.

```bash
# apply
uv run alembic upgrade head

# create, after changing models
uv run alembic revision --autogenerate -m "add something"
```

Read each generated revision before applying it, because autogenerate misses
some changes, such as renames.

## Scheduled jobs

The `scheduler` service runs [`crontab`](../crontab) with supercronic. Times are
in UTC. To add a job:

1. Create `src/<domain>/schedule.py`.
2. Add a line for it to `crontab`. For the schedule syntax, see
   [supercronic's cron expressions](https://github.com/aptible/supercronic/tree/master/cronexpr).

To run a job by hand:

```bash
docker compose -f docker-compose.dev.yaml exec scheduler python -m src.chat.schedule
```

## Tests

Tests need only Postgres and Redis, and no keys. The external services are
faked, and the test database is created automatically.

```bash
docker compose -f docker-compose.dev.yaml up -d postgres redis
uv run pytest
```

## Checks

CI ([`ci.yml`](../.github/workflows/ci.yml)) runs these on every push to `main`.
Run them locally before you push:

```bash
uv run ruff check
uv run ruff format --check
uv run ty check
uv run pytest
```
