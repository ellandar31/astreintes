#!/bin/sh
set -eu

normalize_url() {
  printf '%s' "$1" | sed -E 's#^https?://https?://#http://#; s#/:([0-9]+)$#:\1#'
}

SUPABASE_RUNTIME_URL="$(normalize_url "${SUPABASE_PUBLIC_URL:-}")"

if [ -n "$SUPABASE_RUNTIME_URL" ]; then
  SUPABASE_URL_EXPRESSION="\"$SUPABASE_RUNTIME_URL\""
else
  SUPABASE_URL_EXPRESSION="window.location.origin + \"/supabase\""
fi

cat > /usr/share/nginx/html/app-config.js <<EOF
window.__APP_CONFIG__ = {
  supabaseUrl: ${SUPABASE_URL_EXPRESSION},
  supabaseAnonKey: "${SUPABASE_ANON_KEY:-}"
};
EOF

exec "$@"
