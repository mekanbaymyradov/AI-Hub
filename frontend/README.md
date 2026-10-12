# AI-Hub frontend

React, Vite and TypeScript. To run it next to the API, see the
[development guide](../docs/development.md).

```bash
npm ci
cp .env.example .env.local
npm run dev     # http://localhost:5173
```

Before pushing, run the checks CI runs:

```bash
npm run lint
npm run build
```

Each release deploys it with the API.
