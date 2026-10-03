# Frontend guide

## Where the frontend lives

Build the frontend in `frontend/` at the repo root, with React, Vite and
TypeScript. It keeps its own `package.json` and tooling. The backend's tooling
and CI ignore it.

## Run the API locally

Follow the [development guide](development.md). Sign-in emails a code, so you
need a Resend key. Resend's test sender `onboarding@resend.dev` only delivers
to your own Resend account email.

| | URL |
|---|---|
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| OpenAPI schema | http://localhost:8000/openapi.json |

Swagger and the schema only exist when `ENVIRONMENT=local`.

## Config

- **API URL:** read the base URL from `VITE_API_URL`. Use
  `http://localhost:8000` in dev and `https://api.<domain>` in production.
- **CORS:** the API only accepts browser requests from origins listed in its
  `CORS_ORIGINS`. The default allows Vite's dev server,
  `http://localhost:5173`. In production, set
  `CORS_ORIGINS=["https://<domain>"]` on the API server.
