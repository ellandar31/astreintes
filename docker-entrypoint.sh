#!/bin/sh
set -eu

normalize_url() {
  printf '%s' "$1" | sed -E 's#^https?://https?://#http://#; s#/:([0-9]+)$#:\1#; s#^[[:space:]]+$##'
}

SUPABASE_RUNTIME_URL="$(normalize_url "${SUPABASE_PUBLIC_URL:-}")"

if [ "$SUPABASE_RUNTIME_URL" = "=" ] || [ "$SUPABASE_RUNTIME_URL" = "-" ]; then
  SUPABASE_RUNTIME_URL=""
fi

cat > /usr/share/nginx/html/app-config.js <<EOF
window.__APP_CONFIG__ = {
  supabaseUrl: "${SUPABASE_RUNTIME_URL}",
  supabaseAnonKey: "${SUPABASE_ANON_KEY:-}"
};
EOF

exec "$@"
