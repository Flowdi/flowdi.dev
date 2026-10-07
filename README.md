# flowdi.dev

Source code for [flowdi.dev](https://flowdi.dev), a bilingual portfolio for connected World of Warcraft guild-management tools.

The site presents the current work around:

- Guild Helper, a Discord bot and officer dashboard
- FlowdiUI, a modular in-game interface
- the Guild Bank addon-to-dashboard pipeline
- focused WoW tools such as Data Panels and Layer Tracker

## Architecture

The page itself lives in `src/index.html`. A dependency-free build step embeds it into a small Cloudflare Worker so every response can include strict security headers. This is required for reliable clickjacking protection; HTML metadata alone cannot enforce `frame-ancestors`.

```text
src/index.html
      │
      ▼
scripts/build-worker.mjs
      │
      ▼
dist/server/index.js
```

The generated `dist/` directory is intentionally ignored. It is recreated for validation and deployment.

## Development

Requirements: Node.js 20 or newer. No package installation is required.

```bash
npm run build
npm test
```

`npm run check` performs the complete local verification used by CI.

## Security

The Worker applies a restrictive Content Security Policy, blocks framing with both CSP and `X-Frame-Options`, enables HSTS, isolates the origin, disables unused browser permissions and rejects unsupported HTTP methods.

Security behavior is tested by `scripts/validate-artifact.mjs`. Please see [SECURITY.md](SECURITY.md) for reporting guidance.

## Deployment

Production is hosted through OpenAI Sites and served from the custom domain `flowdi.dev`. The generated `chatgpt.site` address redirects permanently to the custom domain.

The `.openai/hosting.json` file binds this checkout to the existing Site project. It must not be replaced with a new project identifier.
