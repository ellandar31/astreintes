#!/bin/sh
set -eu

cat > /usr/share/nginx/html/app-config.js <<EOF
window.__APP_CONFIG__ = {
  supabaseUrl: "${SUPABASE_URL:-http://127.0.0.1:54321}",
  supabaseAnonKey: "${SUPABASE_ANON_KEY:-}"
};
EOF

exec "$@"
