---
title: Tencent Lighthouse Default Deployment Profile
date: 2026-07-05
status: local-preflight
profile_id: lighthouse-default
scope: private-docker-compose, nginx-loopback, fs-kv, lightweight-runtime
---

# Tencent Lighthouse Default Deployment Profile

## Profile

`lighthouse-default` is the first WCPT deployment profile for a small Tencent Cloud Lighthouse server.

This profile optimizes for private operation, predictable startup, a smaller runtime surface, and local filesystem persistence.

## Required Defaults

| Area | Default | Reason |
| --- | --- | --- |
| Docker image | `WECHAT_ARTICLE_EXPORTER_IMAGE=wechat-article-exporter:local` | Use the lightweight image as the first-release baseline. |
| PDF runtime | `INSTALL_PDF_RUNTIME=false` | Keep Chromium/Puppeteer out of the default image. |
| KV storage | `NITRO_KV_DRIVER=fs`, `NITRO_KV_BASE=.data/kv` | Keep credentials and local state on the server filesystem volume. |
| Public Open API | `NUXT_OPEN_API_ENABLED=false` | Private UI does not require `/api/public/**`. |
| LLM workflow | `NUXT_LLM_ENABLED=false`, `NUXT_LLM_ARTICLE_SUMMARY_MODE=disabled` | Provider calls require a separate live authorization gate. |
| Provider authorization | `NUXT_LLM_PROVIDER_CALL_AUTHORIZED=false` | Default profile must not call DeepSeek/Kimi/Moonshot. |
| Nginx upstream | `127.0.0.1:3088` | Keep the app container loopback-only behind Nginx/TLS. |

## PDF Opt-In Profile

PDF generation is not part of `lighthouse-default`.

To enable container PDF generation, build and deploy a separate opt-in image after local acceptance:

```sh
WECHAT_ARTICLE_EXPORTER_IMAGE=wechat-article-exporter:pdf-local \
INSTALL_PDF_RUNTIME=true \
docker compose build wechat-article-exporter
```

The opt-in profile must be validated separately because it installs `chromium-headless-shell`, CJK/emoji fonts, and `puppeteer@24`, increasing image size and package download risk.

## Local Preflight Only

The checks in this repository are local preflight checks unless an operator separately authorizes production work.

- `push_executed=false`
- `deploy_attempted=false`
- `provider_call=false`
- `production_changed=false`
- `production unchanged`

## Production Gates

Before a real Tencent Lighthouse deployment, the operator must complete these separate gates:

1. Review and intentionally select either `lighthouse-default` or the PDF opt-in profile.
2. Inject secrets only through server runtime environment or a server-local `.env` file outside git.
3. Validate Nginx rendering from `deploy/nginx/wcpt-loopback.conf.template`.
4. Run production server read-only inventory after explicit authorization.
5. Deploy only after explicit authorization.
6. Run production acceptance checks after deployment.
7. Authorize provider calls separately before any live DeepSeek/Kimi/Moonshot request.
