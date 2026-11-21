# Debugging a failed reply

A user writes in: "I sent a message and got an error." This guide finds the
cause, says what to tell them and what to fix. The example throughout is a real
failure from 2026-11-03.

## What the user sees

The chat shows the error in red under the user's message, with a **Retry**
button and a **Try another model** menu:

```text
⚠ The model failed to reply.
Error ID: 01a1a23e4f05572d5e6aa3e9686f91e1
```

The error carries only the code `llm.model_error` and the Error ID, never the
provider's message, so the user can't tell you the cause. The Error ID is the
failed request's trace ID, and the trace has the cause, without Logfire ever
storing what they wrote.

## 1. Open the trace

Ask the user for the Error ID; a screenshot works. In Logfire's Live view,
filter by it:

```sql
trace_id = '01a1a23e4f05572d5e6aa3e9686f91e1'
```

Or open
`https://logfire-eu.pydantic.dev/mekanbaymyradov/ai-hub/?q=trace_id%3D%27<Error ID>%27&last=30d`.
Logfire keeps 30 days of data, so an older ID finds nothing.

## 2. Read the trace

The example's Error ID belongs to a retry. Its trace looks like this:

```text
POST /chats/{chat_id}/retry → 200               0.18 s   user_id 1
├─ INCRBY EXPIRE TTL                                     rate-limit checks
├─ SELECT …                                              user, chat, history
├─ agent run                                    ✗
│  └─ chat ministral-8b-latest
│     └─ POST api.mistral.ai/v1/chat/completions → 401
└─ Reply failed                                 ✗        Invalid API Key
```

The red span is the call to Mistral, and Mistral answered 401 in under 0.1
seconds. A failure that fast is a configuration problem, not load: the
provider rejected our API key before reading anything. Nothing about the
user's message was wrong.

## 3. Name the cause

The status code in the cause decides who fixes it and what the user hears.

| Cause | Meaning | Fix | Tell the user |
|---|---|---|---|
| `status_code: 401` | The provider rejected our API key. | Replace the key in `/opt/ai-hub/.env`, then `docker compose up -d --force-recreate app`. A plain `restart` keeps the old key. | "That model is down on our side. Use **Try another model** under your message for now; I'll let you know when it's back." |
| `status_code: 403` | Our plan doesn't include this model. | Remove it from the catalog in [`src/llm/models.py`](../src/llm/models.py), as `7baa627` did for Mistral Large. | "That model is no longer available. Please pick another one." |
| `status_code: 404` | The provider renamed or retired the model. | Update or remove it in the catalog. | The same as for 403. |
| `status_code: 429` | The provider's rate limit or quota. Free tiers hit this. | Usually nothing. If it lasts, check the quota. | "That model is busy right now. Try again in a minute, or pick another one." |
| `status_code: 5xx` | The provider is down. | Check its status page. | "The model's provider is having problems. Please pick another model for now." |

## 4. Confirm the fix

Send a message with the same model on the live site, and check that its trace
has no `Reply failed`. Then reply to the user.

## No Error ID?

The Error ID isn't saved with the chat, so it's gone once the page reloads.
Then find the user's failed replies by their ID. Logs and traces identify users
by ID, never by email, so look it up on the server first:

```bash
cd /opt/ai-hub
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

```sql
SELECT id FROM "user" WHERE email = 'user@example.com';
```

Don't look for 500s: a reply is streamed, so its request has already returned
200 by the time the model is called. Look for the `Reply failed` log instead.
The log doesn't carry the user's ID, but the request span in the same trace
does, so join the two in Logfire's Explore view:

```sql
SELECT req.start_timestamp, req.trace_id, req.span_name AS request,
       fail.attributes->>'model_id' AS model, fail.exception_message AS cause
FROM records fail
JOIN records req ON req.trace_id = fail.trace_id AND req.parent_span_id IS NULL
WHERE fail.deployment_environment = 'production'
  AND fail.span_name = 'Reply failed'
  AND req.attributes->>'user_id' = '1'
ORDER BY req.start_timestamp DESC
LIMIT 20
```

The example returns two rows:

| Time (UTC) | Request | Model | Cause |
|---|---|---|---|
| 16:29:11 | `POST /chats/{chat_id}/messages` | `mistral:ministral-8b-latest` | `status_code: 401 … {"detail":"Invalid API Key"}` |
| 16:29:14 | `POST /chats/{chat_id}/retry` | `mistral:ministral-8b-latest` | the same |

The user pressed retry three seconds later and got the same error, so this is
not a one-off. Open either trace by its `trace_id` and continue from step 2.

## Alerts usually get there first

Two Logfire alerts watch `Reply failed`, so most failures reach you before a
user does:

- **🔴 Chat replies failing** runs every 10 minutes and reports the model and
  cause for anything we have to fix: 401, 403, 404 and unexpected errors. On
  2026-11-03 it fired for 16:26–16:36 with
  `mistral:ministral-8b-latest · 401: bad API key · 2 failed replies`.
- **🟡 LLM provider limits** reports 429s and 5xx, but only after 5 in an hour,
  because a one-off limit is normal on a free tier.

## Noise to ignore

Warnings for 404s on paths like `/.env`, `/robots.txt` or `/laravel/.env` are
bots scanning the API for leaked secrets. They need no action.
