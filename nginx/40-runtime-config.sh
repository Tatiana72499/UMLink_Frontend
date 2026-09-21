#!/bin/sh
# Genera /config.js con las URLs públicas. Vacío = mismo origen (proxy de nginx).
cat > /usr/share/nginx/html/config.js <<CFG
window.__UMLINK_CONFIG__ = { apiUrl: "${PUBLIC_API_URL:-}", webSocketUrl: "${PUBLIC_WS_URL:-}" };
CFG
