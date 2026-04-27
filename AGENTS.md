# Repository Guidelines

## Project Structure & Module Organization
This repository is a Nuxt 3 application with client pages in `pages/`, reusable UI in `components/`, and stateful client logic in `composables/` and `store/v2/`. Shared parsing and rendering code lives in `shared/utils/` and `utils/`. Server endpoints and helpers are under `server/api/`, `server/utils/`, and `server/kv/`. Static assets belong in `public/` and `assets/`. Sample WeChat HTML fixtures used for regression checks are stored in `samples/`, and ad hoc validation scripts live in `test/`.

## Build, Test, and Development Commands
Use Node `>=22` and Yarn `1.22.22`.

- `corepack enable && corepack prepare yarn@1.22.22 --activate && yarn`: install dependencies.
- `yarn dev`: start the local Nuxt development server.
- `yarn build`: produce a production build in `.output/`.
- `yarn preview`: build for the Cloudflare Pages target and run a local preview.
- `yarn format`: run Biome formatting and import organization.
- `yarn docker:build`: build the published container image.

## Coding Style & Naming Conventions
Biome is the formatting source of truth; use `yarn format` before opening a PR. The codebase uses 2-space indentation, semicolons, single quotes in JS/TS, and a 120-column target. Keep Vue components in PascalCase such as `components/dashboard/SideBar.vue`, composables in `useX.ts` form, and route files lowercase such as `pages/dashboard/article.vue`. Place shared type declarations in `types/*.d.ts` or `server/types.d.ts`. Avoid editing generated vendor assets in `public/vendors/` unless you are intentionally updating a bundled dependency.

## Testing Guidelines
There is currently no unified `yarn test` script. For parser, renderer, and export changes, add or update a focused script in `test/` and validate against the HTML fixtures in `samples/`. Follow the existing script naming style, for example `test/normalize_html.ts` and `test/render_html_from_cgi_data.ts`. In every PR, state the exact validation command or manual flow you ran.

## Commit & Pull Request Guidelines
Recent history uses short version bumps plus concise `feat:` and `fix:` subjects. Prefer descriptive commit messages such as `fix: handle empty CGI payload in exporter` and keep each commit narrowly scoped. PRs should explain the user-visible change, link the relevant issue when available, note any config or deployment impact, and include screenshots for UI changes. Call out test coverage and known gaps explicitly.

## Security & Configuration Tips
Do not commit live WeChat credentials, exported article data, or local OMX state. Runtime configuration is environment-driven; common variables include `NUXT_AGGRID_LICENSE`, `NUXT_SENTRY_*`, `NUXT_UMAMI_*`, and Nitro KV settings.
