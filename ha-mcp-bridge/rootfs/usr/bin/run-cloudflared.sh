#!/usr/bin/with-contenv bashio

# Read Cloudflared configuration from add-on options
CLOUDFLARED_ENABLED="$(bashio::config 'cloudflared.enabled')"
CLOUDFLARED_TOKEN="$(bashio::config 'cloudflared.token')"

if [[ "${CLOUDFLARED_ENABLED}" == "true" ]] && [[ -n "${CLOUDFLARED_TOKEN}" ]]; then
    bashio::log.info "Starting Cloudflared tunnel..."
    exec /usr/local/bin/cloudflared tunnel --no-autoupdate run --token "${CLOUDFLARED_TOKEN}"
else
    bashio::log.info "Cloudflared is disabled or no token provided"
    exit 0
fi