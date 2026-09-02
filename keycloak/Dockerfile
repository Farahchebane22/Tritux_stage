FROM quay.io/keycloak/keycloak:26.0
COPY realm-tritux-helpdesk.json /opt/keycloak/data/import/realm-tritux-helpdesk.json
ENV KC_HTTP_ENABLED=true
ENV KC_HOSTNAME_STRICT=false
ENV KC_PROXY_HEADERS=xforwarded
CMD ["start-dev", "--import-realm"]
