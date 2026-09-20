#!/bin/sh
# Writes /config.js so one image can be configured for any company at start-up.
set -eu

# Escape backslashes and double quotes so environment values can never break out of the string.
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = {
  APP_NAME: "$(esc "${APP_NAME:-}")",
  APP_TAGLINE: "$(esc "${APP_TAGLINE:-}")",
  API_URL: "$(esc "${API_URL:-/api/v1}")",
  DEMO_MODE: "$(esc "${DEMO_MODE:-false}")"
};
CONFIG
echo "Runtime config written to /usr/share/nginx/html/config.js"
