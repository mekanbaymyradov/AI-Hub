# Architecture

The code is split by domain under `src/`: `auth`, `chat`, `llm` and
`notifications`. Each domain has its own `router`, `service`, `flows`, `models`
and `config` modules as it needs them. Shared infrastructure lives at the top
of `src/`.

## Auth

`src/auth/`. Sign-in is passwordless:

1. `POST /auth/otp/request` emails a 6-digit code. The code lives in Redis
   for 5 minutes and allows 5 attempts.
2. `POST /auth/otp/verify` exchanges the code for a 15-minute access JWT and a
   30-day refresh token of the form `sid.secret`.

Sessions are stored in Redis, keyed by `sid`. Only a hash of the refresh token
is stored.
Refreshing rotates both tokens. Reusing a refresh token that was already
rotated revokes the whole session, since that means it was stolen
(`src/auth/sessions.py`). Avatars go to the public bucket.

## LLM registry

`src/llm/registry.py`. On startup, one Pydantic AI model is built for each
provider that has an API key, and providers without a key are left out. The
catalog is served at `GET /llms/models`.

## Streaming

`POST /chats/messages` streams the reply over Server-Sent Events using
FastAPI's `EventSourceResponse` (`src/chat/router.py`).

## Attachments

`src/chat/`. Attachments follow a lifecycle:

1. **Upload.** Files are uploaded before the message, with
   `POST /chats/attachments`, into the private bucket. Up to 5 images or PDFs
   of 10 MiB each.
2. **Claim.** The returned ids are sent as `attachment_ids` with the message.
   Each id can be claimed once.
3. **Read.** Files are read through signed URLs that expire after 15 minutes.
4. **Clean up.** An hourly scheduler job (`src/chat/schedule.py`) deletes
   uploads still unclaimed after 24 hours. It deletes rows before files,
   because deleting a file first could lose one that a message claims at that
   moment. A failed file delete only leaves a stray file, and the same job
   removes stray files that have no row.

Deleting a chat also deletes its files.

## Rate limiting

`src/rate_limit.py`. The limiter is a fixed-window counter in Redis.

- **App-wide:** every request counts toward an app-wide limit: 100 per minute
  per user when signed in, 60 per minute per IP otherwise.
- **Expensive routes:** some routes add their own limit:

  | Route | Limit |
  |---|---|
  | Request a sign-in code | 5 per hour per IP |
  | Exchange a code | 10 per 15 minutes per IP |
  | Upload files | 30 per minute per user |
  | Send a message | 20 per minute per user |

- **Response:** a request over the limit gets a 429 with `Retry-After`.
- **Failure:** if Redis is down, the limiter fails open and logs a warning,
  instead of blocking all traffic.
- **Exempt:** `/healthz` is not counted.

## Pagination

`src/pagination.py`. Lists use cursor pagination:

- **Query:** `?limit=` takes 1–100 (default 20), and `?cursor=` takes the
  previous page's `next_cursor`.
- **End of list:** `next_cursor` is `null` on the last page.
- **Cursor:** opaque, URL-safe base64 JSON. One list's cursor is rejected by
  another.

## Logging and observability

Logfire is the only logging API: code calls `logfire.info()`,
`logfire.exception()` and so on, never `logging` (`src/observability.py`).

- **Traces:** each request is one trace, with its SQL, Redis, R2, outgoing HTTP
  and Pydantic AI calls as child spans. Redis is traced because the rate limiter
  calls it on every request, so a slow Redis shows up as a span instead of an
  unexplained gap. Each cron job is one `Job run` trace
  (`src/jobs.py`). `/healthz` is left out. Signed-in requests carry `user_id` on
  the request span (`get_current_user` in `src/auth/dependencies.py`), so one
  filter finds a user's requests and logs.
- **Logs:** attach to the span they are emitted in, so there is no request ID.
  Library warnings and errors from `logging` reach Logfire too.
- **Naming:** every log and span message is a fixed `"<Subject> <outcome>"`
  template in sentence case, such as `"Reply failed"`. Values go in as
  `{placeholders}` or keyword arguments; both become queryable attributes. Never
  use f-strings: each message would be unique, which breaks grouping and any
  alert that matches on the template.
- **Console:** locally, every log and span start prints. In production, docker
  logs show only warning and error logs (`LOGFIRE_CONSOLE_MIN_LOG_LEVEL` in the
  compose file), plus the tracebacks uvicorn and failed jobs print themselves.
  A span that ends in an error never prints; look it up in Logfire.
- **Containers:** in production, an OpenTelemetry Collector sends each
  container's CPU, memory and restarts to Logfire (`otel-collector` in
  `docker-compose.prod.yaml`). It doesn't run locally.
- **Privacy:** production traces carry no chat text, only model, tokens and
  timing. Request spans record the client's
  input locally, but in production only validation errors, without the rejected
  input (`request_attributes_mapper` in `src/observability.py`), plus the signed-in
  user's ID. Logs and spans identify users by ID, never by email.
