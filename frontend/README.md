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
npm test
npm run build
```

Each release deploys it with the API.

## Translations

The interface is in English, Russian and Turkmen. All its text lives in
[`src/i18n`](src/i18n): `en.ts` is the source, and `ru.ts` and `tk.ts` must have
the same keys, which `npm run build` checks. To add text, add the key to all
three files and use it with `t("area.key")` from `useTranslation()`.

- Plurals: Russian needs `_one`, `_few` and `_many`, so every plural key has all
  four forms (with `_other`) in every file.
- Highlighted parts are marked `<b>…</b>` and rendered with `<Trans>`.
- `npm test` checks that each translation keeps the English text's `{{variables}}`
  and `<b>` marks.
