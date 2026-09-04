#!/bin/sh
cat <<EOF > /usr/share/nginx/html/config.js
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:5000/api}",
  VITE_KEYCLOAK_ENABLED: "${VITE_KEYCLOAK_ENABLED:-false}",
  VITE_KEYCLOAK_URL: "${VITE_KEYCLOAK_URL:-http://localhost:8081}",
  VITE_KEYCLOAK_REALM: "${VITE_KEYCLOAK_REALM:-tritux-helpdesk}",
  VITE_KEYCLOAK_CLIENT_ID: "${VITE_KEYCLOAK_CLIENT_ID:-tritux-frontend}"
};
EOF
