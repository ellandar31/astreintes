#!/bin/sh
set -eu

normalize_url() {
  input_url="$1"
  # Preserve the original protocol, including TLS, when correcting duplicated schemes.
  printf '%s' "$input_url" | sed -E 's#^(https?://)(https?://)+#\1#; s#/:([0-9]+)$#:\1#; s#^[[:space:]]+$##'
}

SUPABASE_RUNTIME_URL="$(normalize_url "${SUPABASE_PUBLIC_URL:-}")"

if [ "$SUPABASE_RUNTIME_URL" = "=" ] || [ "$SUPABASE_RUNTIME_URL" = "-" ]; then
  SUPABASE_RUNTIME_URL=""
fi

cat > /tmp/astreintes-app-config.js <<EOF
window.__APP_CONFIG__ = {
  supabaseUrl: "${SUPABASE_RUNTIME_URL}",
  supabaseAnonKey: "${SUPABASE_ANON_KEY:-}"
};
EOF

exec "$@"
