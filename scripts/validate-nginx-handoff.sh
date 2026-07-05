#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/tmp/outputs/nginx-handoff-validate-20260704.txt"
TEMPLATE="$ROOT/deploy/nginx/wcpt-loopback.conf.template"
RUNBOOK="$ROOT/docs/tencent-lighthouse-nginx-handoff.md"
MATRIX="$ROOT/docs/deployment-matrix.md"

mkdir -p "$ROOT/tmp/outputs"
: > "$OUT"

note() {
  printf '%s\n' "$*" | tee -a "$OUT"
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    note "missing_file=$file"
    exit 1
  fi
}

require_text() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q "$pattern" "$file"; then
    note "$label=pass"
  else
    note "$label=needs_review"
    exit 1
  fi
}

require_file "$TEMPLATE"
require_file "$RUNBOOK"
require_file "$MATRIX"

require_text "$TEMPLATE" "proxy_pass http://127\\.0\\.0\\.1:3088;" "loopback_upstream"
require_text "$TEMPLATE" 'proxy_set_header Host \$host;' "host_header"
require_text "$TEMPLATE" 'proxy_set_header X-Forwarded-Proto \$scheme;' "forwarded_proto_header"
require_text "$TEMPLATE" "client_max_body_size 64m;" "client_body_size"
require_text "$TEMPLATE" "__WCPT_DOMAIN__" "domain_placeholder"
require_text "$TEMPLATE" "__TLS_CERT_PATH__" "cert_placeholder"
require_text "$TEMPLATE" "__TLS_KEY_PATH__" "key_placeholder"
require_text "$RUNBOOK" "production unchanged" "boundary_production_unchanged"
require_text "$RUNBOOK" "provider_call=false" "boundary_provider_call"
require_text "$MATRIX" "127\\.0\\.0\\.1:3088" "deployment_matrix_loopback"

if ! command -v nginx >/dev/null 2>&1; then
  note "nginx_binary=absent"
  note "nginx_syntax_check=skipped"
  note "result=pass"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  note "openssl_binary=absent"
  note "nginx_syntax_check=skipped"
  note "result=pass"
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$TMP_DIR/wcpt.key" \
  -out "$TMP_DIR/wcpt.crt" \
  -subj "/CN=localhost" \
  -days 1 >/dev/null 2>&1

sed \
  -e "s#__WCPT_DOMAIN__#localhost#g" \
  -e "s#__TLS_CERT_PATH__#$TMP_DIR/wcpt.crt#g" \
  -e "s#__TLS_KEY_PATH__#$TMP_DIR/wcpt.key#g" \
  "$TEMPLATE" > "$TMP_DIR/wcpt-loopback.conf"

cat > "$TMP_DIR/nginx.conf" <<EOF
events {}
http {
    include $TMP_DIR/wcpt-loopback.conf;
}
EOF

if nginx -t -c "$TMP_DIR/nginx.conf" -p "$TMP_DIR" >> "$OUT" 2>&1; then
  note "nginx_syntax_check=pass"
else
  note "nginx_syntax_check=needs_review"
  exit 1
fi

note "result=pass"
