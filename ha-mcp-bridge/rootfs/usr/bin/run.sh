#!/usr/bin/with-contenv bashio

# Load configuration from Home Assistant
CONFIG_PATH=/data/options.json
export ADDON_CONFIG="$(bashio::config)"

# Log startup
bashio::log.info "Starting HA MCP Bridge Add-on..."
bashio::log.info "Version: $(bashio::addon.version)"
bashio::log.info "Configuration loaded from: ${CONFIG_PATH}"

# Determine external access method
EXTERNAL_METHOD="$(bashio::config 'external_access.method')"
bashio::log.info "External access method: ${EXTERNAL_METHOD}"

# Configure server URL based on access method
if [[ "${EXTERNAL_METHOD}" == "nabu_casa" ]] && bashio::config.true 'nabu_casa.expose_port'; then
    # Try to get Nabu Casa URL from supervisor
    NABU_CASA_INFO=$(bashio::api.supervisor "GET" "/cloud/info" 2>/dev/null || echo '{}')
    NABU_CASA_URL=$(echo "${NABU_CASA_INFO}" | jq -r '.data.instance_url // empty' 2>/dev/null || echo "")
    
    if [[ -n "${NABU_CASA_URL}" ]]; then
        export SERVER_URL="${NABU_CASA_URL}:$(bashio::config 'external_port')"
        bashio::log.info "Configured for Nabu Casa access: ${SERVER_URL}"
    else
        bashio::log.warning "Nabu Casa URL not available, using manual configuration"
        export SERVER_URL="$(bashio::config 'server_url')"
    fi
else
    # Use manual configuration for port_forward or reverse_proxy
    export SERVER_URL="$(bashio::config 'server_url')"
    bashio::log.info "Using manual server URL configuration: ${SERVER_URL}"
fi

# Set environment variables from add-on config
export PORT="$(bashio::config 'external_port')"
export LOG_LEVEL="$(bashio::config 'log_level')"
export DEBUG="$(bashio::config 'debug')"

# OAuth configuration with dynamic redirect URI
export OAUTH_ENABLED="$(bashio::config 'oauth.enable')"
export ADMIN_USERNAME="$(bashio::config 'oauth.admin_username')"
export ADMIN_PASSWORD="$(bashio::config 'oauth.admin_password')"
export OAUTH_REDIRECT_URI="${SERVER_URL}/oauth/callback"

# Timeout settings (preserve optimizations)
export REQUEST_TIMEOUT="$(bashio::config 'timeouts.request_timeout')"
export KEEPALIVE_TIMEOUT="$(bashio::config 'timeouts.keepalive_timeout')"
export SSE_PING_INTERVAL="$(bashio::config 'timeouts.sse_ping_interval')"

# Home Assistant integration
if bashio::config.true 'ha_integration.use_supervisor_token'; then
    export HA_URL="http://supervisor/core"
    export HA_TOKEN="${SUPERVISOR_TOKEN}"
    bashio::log.info "Using supervisor token for HA API access"
else
    export HA_URL="$(bashio::config 'ha_integration.external_ha_url')"
    export HA_TOKEN="$(bashio::config 'ha_integration.external_ha_token')"
    bashio::log.info "Using external HA configuration"
fi

# CORS origins - include Nabu Casa domains automatically
CORS_ORIGINS="$(bashio::config 'cors_origins')"
if [[ "${EXTERNAL_METHOD}" == "nabu_casa" ]] && [[ -n "${NABU_CASA_URL}" ]]; then
    # Add Nabu Casa domain to CORS origins
    NABU_CASA_DOMAIN=$(echo "${NABU_CASA_URL}" | sed 's|https\?://||')
    export CORS_ORIGIN="${CORS_ORIGINS},https://${NABU_CASA_DOMAIN}"
else
    export CORS_ORIGIN="${CORS_ORIGINS}"
fi

# Ingress configuration
export INGRESS_URL="/api/hassio/app/ha_mcp_bridge"
export INGRESS_PORT="$(bashio::config 'external_port')"

# Log final configuration
bashio::log.info "External URL: ${SERVER_URL}"
bashio::log.info "Ingress URL: ${INGRESS_URL}"
bashio::log.info "Port: ${PORT}"
bashio::log.info "OAuth Redirect: ${OAUTH_REDIRECT_URI}"

# Change to application directory
cd /usr/src/app

# Start the MCP server
bashio::log.info "Starting MCP server with ingress and external access support..."
exec node server.js