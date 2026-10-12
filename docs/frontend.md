# Frontend guide

## Where the frontend lives

Build the frontend in `frontend/` at the repo root, with React, Vite and
TypeScript. It keeps its own `package.json` and tooling, and the backend's
tooling ignores it. [CI](../.github/workflows/ci.yml) runs `npm run lint`, then
builds the production image, which runs `npm run build`.

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

## Run the frontend

Either way, the app runs on http://localhost:5173. The two can't run at the
same time, since both need that port, and the API's CORS only allows it.

**With Docker**, no Node needed. Start the API's stack with the `frontend`
profile; edits in `frontend/` sync into the container and reload the page, and
a change to `package.json` or the lockfile rebuilds it:

```bash
docker compose -f docker-compose.dev.yaml --profile frontend up --watch
```

**On your machine**, for the fastest reload and your editor's use of
`node_modules`. You need Node 24, the version in
[`frontend/.nvmrc`](../frontend/.nvmrc); `nvm use` or `fnm use` in `frontend/`
picks it up. With the API running:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Before pushing, run `npm run lint` and `npm run build`; CI fails on either.

## Config

- **API URL:** read the base URL from `VITE_API_BASE_URL`. It defaults to
  `http://localhost:8000`, the local API. `npm run build` takes the production
  URL from [`frontend/.env.production`](../frontend/.env.production) and bakes
  it into the bundle.
- **CORS:** the API only accepts browser requests from origins listed in its
  `CORS_ORIGINS`. The default allows Vite's dev server,
  `http://localhost:5173`.

## Build and deploy

The last stage of [`frontend/Dockerfile`](../frontend/Dockerfile) is the
production image: `npm run build`, then Caddy serving `dist/` as a non-root
user, configured by [`frontend/Caddyfile`](../frontend/Caddyfile). It sends
index.html for any path that isn't a file, since `BrowserRouter` handles
routes like `/chats/<id>` in the browser, and lets browsers cache
`/assets/*` for a year, since Vite puts a content hash in those names. The
`dev` stage is the dev server above.

Each release ships the frontend with the API, at `https://ai-hub.<domain>`;
see the [deployment guide](deployment.md). The edge Caddy in
[`deploy/Caddyfile`](../deploy/Caddyfile) sets its security headers,
including the Content-Security-Policy. Loading anything from a new host, like
an image CDN or an analytics script, needs that host added there.

To try the production image locally:

```bash
docker build -t ai-hub-frontend frontend
docker run --rm -p 8080:8080 ai-hub-frontend   # http://localhost:8080
```

It calls the production API, whose CORS doesn't allow `localhost`, so this
checks the serving, not sign-in.
