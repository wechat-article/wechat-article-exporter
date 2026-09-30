# wechat-exporter CLI

`wechat-exporter` is a command-line client for the local Nuxt backend. It is meant to cover backend capabilities without operating the web UI.

## Run

From the repository:

```bash
node cli/wechat-exporter.mjs --help
```

From the Docker container:

```bash
docker exec wechat-article-exporter node cli/wechat-exporter.mjs --help
```

The CLI defaults to `http://127.0.0.1:3000` and auto-detects the first auth key under `.data/kv/cookie`.

## Login

```bash
docker exec wechat-article-exporter node cli/wechat-exporter.mjs login
```

The command saves a QR code to `.data/login-qrcode.jpg`, polls scan status, and prints the new `auth_key` after phone confirmation.

Use a specific auth key:

```bash
node cli/wechat-exporter.mjs me --auth-key <auth-key>
```

## Common Commands

```bash
node cli/wechat-exporter.mjs me
node cli/wechat-exporter.mjs search-account --keyword 华普亿方数智就创业
node cli/wechat-exporter.mjs account-by-url --url 'https://mp.weixin.qq.com/s/...'
node cli/wechat-exporter.mjs articles --account 华普亿方数智就创业 --year 2026 --all
node cli/wechat-exporter.mjs articles --fakeid MzIyODc5NTA1NQ== --year 2026 --all
```

## Export

Export one year to HTML, Markdown, text, or JSON files in a zip:

```bash
node cli/wechat-exporter.mjs export --account 华普亿方数智就创业 --year 2026 --format markdown
```

Export one year of an official account to Word files in a zip:

```bash
node cli/wechat-exporter.mjs export-word --account 华普亿方数智就创业 --year 2026
```

Export one year to PDF files in a zip:

```bash
node cli/wechat-exporter.mjs export-pdf --account 华普亿方数智就创业 --year 2026
```

Download a single article:

```bash
node cli/wechat-exporter.mjs download --url 'https://mp.weixin.qq.com/s/...' --format markdown --output article.md
```

Supported single-article formats are `html`, `markdown`, `text`, and `json`.

## Album, Comments, Proxy

```bash
node cli/wechat-exporter.mjs album --fakeid <biz> --album-id <album-id>
node cli/wechat-exporter.mjs comments --url 'https://mp.weixin.qq.com/s/...'
node cli/wechat-exporter.mjs current-ip
node cli/wechat-exporter.mjs proxy-metrics
node cli/wechat-exporter.mjs blocked-ips
```

`comments` requires a rich WeChat article URL that includes comment credentials, or explicit `--comment-id`, `--key`, `--uin`, and `--pass-ticket` arguments.

## Public API Shortcuts

These map to `/api/public/v1/*` endpoints:

```bash
node cli/wechat-exporter.mjs public-account --keyword 华普亿方数智就创业
node cli/wechat-exporter.mjs public-articles --fakeid MzIyODc5NTA1NQ==
```

## Raw API Passthrough

Every backend endpoint can be called through `api`:

```bash
node cli/wechat-exporter.mjs api GET /api/web/mp/info
node cli/wechat-exporter.mjs api GET /api/web/worker/overview-metrics
node cli/wechat-exporter.mjs api POST /api/web/cli/export-word --body '{"account":"华普亿方数智就创业","year":2026}'
```

Add query parameters with repeated `--query k=v`:

```bash
node cli/wechat-exporter.mjs api GET /api/web/mp/searchbiz --query keyword=华普亿方数智就创业 --query size=20
```

## Coverage Notes

Native CLI commands cover:

- QR-code login and auth-key validation
- Logged-in account info and logout
- Official account search and account resolution by article URL
- Official account article listing
- Single article download
- Year-based HTML, Markdown, text, and JSON zip export
- Year-based Word zip export
- Year-based PDF zip export
- Album listing
- Comment fetching when credentials are available
- Proxy status endpoints
- Public API account/article endpoints

The following UI behavior is intentionally not mirrored as first-class CLI commands:

- Browser table layout, filter state, and column settings
- Browser IndexedDB cache inspection
- Account favorites stored only in browser state
- Export options stored in `localStorage`
- Excel export, until the browser-side table/export options are backed by a stable server contract

For those, use command options, raw `api`, or add a backend-backed feature first.
