# Home Assistant Add-on Ingress and External Access Guide

This document explains how the HA MCP Bridge add-on will be accessible through Home Assistant's ingress system and external URLs.

## 🌐 Home Assistant Access Methods

### 1. Ingress (Internal HA Access)
**URL Pattern**: `https://your-ha-instance.ui.nabu.casa/api/hassio/app/ha_mcp_bridge`

```yaml
# In config.yaml - Already configured
ingress: true
ingress_port: 3003
ingress_stream: false
panel_icon: "mdi:home-assistant"
panel_title: "MCP Bridge"
webui: "http://[HOST]:[PORT:3003]"
```

**How it works**:
- HA Supervisor proxies requests through `/api/hassio/app/{addon_slug}`
- Automatically handles authentication via HA session
- Accessible from HA sidebar panel
- Works with Nabu Casa Cloud URLs
- No additional port forwarding needed

### 2. Direct Port Access (External)
**URL Pattern**: `https://your-domain.com:3003` or `https://your-ha-instance.ui.nabu.casa:3003`

```yaml
# In config.yaml - Already configured
ports:
  3003/tcp: 3003
```

**How it works**:
- Requires port 3003 to be exposed
- Needs router port forwarding (non-Nabu Casa)
- Direct access to MCP server
- Required for Claude.ai external connections

## 🔄 Access Flow for Claude.ai

### Recommended Setup for Claude.ai Integration

1. **Nabu Casa Users**:
   ```
   Claude.ai → https://your-instance.ui.nabu.casa:3003 → HA MCP Bridge
   ```

2. **Self-hosted Users**:
   ```
   Claude.ai → https://your-domain.com:3003 → Router → HA → MCP Bridge
   ```

3. **Local Network Users**:
   ```
   Claude.ai → https://your-local-ip:3003 → HA → MCP Bridge
   ```

## 📝 Configuration Updates for External Access

### Enhanced config.yaml for External Access
```yaml
# Network configuration
ports:
  3003/tcp: 3003

# Ingress configuration (for HA UI)
ingress: true
ingress_port: 3003
ingress_stream: false
panel_icon: "mdi:home-assistant"
panel_title: "MCP Bridge"
webui: "http://[HOST]:[PORT:3003]"

# External access options
options:
  external_access:
    enabled: true
    method: "nabu_casa"  # or "port_forward" or "reverse_proxy"
    custom_domain: ""
    ssl_certificate: "letsencrypt"
  
  nabu_casa:
    expose_port: true
    auto_ssl: true
    
  port_forwarding:
    external_port: 3003
    requires_router_config: true
    
  reverse_proxy:
    enabled: false
    proxy_url: ""
    custom_headers: {}

schema:
  external_access:
    enabled: "bool"
    method: "list(nabu_casa|port_forward|reverse_proxy)"
    custom_domain: "str?"
    ssl_certificate: "list(letsencrypt|custom|none)"
  nabu_casa:
    expose_port: "bool"
    auto_ssl: "bool"
  port_forwarding:
    external_port: "port"
    requires_router_config: "bool"
  reverse_proxy:
    enabled: "bool"
    proxy_url: "url?"
    custom_headers: "dict?"
```

### Updated Startup Script (rootfs/usr/bin/run.sh)
```bash
#!/usr/bin/with-contenv bashio

# Load configuration
export ADDON_CONFIG="$(bashio::config)"

# Determine external access method
EXTERNAL_METHOD="$(bashio::config 'external_access.method')"
NABU_CASA_ENABLED="$(bashio::config 'nabu_casa.expose_port')"

# Configure server URL based on access method
if [[ "${EXTERNAL_METHOD}" == "nabu_casa" ]] && bashio::config.true 'nabu_casa.expose_port'; then
    # Nabu Casa Cloud access
    NABU_CASA_URL=$(bashio::api.supervisor "GET" "/cloud/info" | jq -r '.data.instance_url // empty')
    if [[ -n "${NABU_CASA_URL}" ]]; then
        export SERVER_URL="${NABU_CASA_URL}:3003"
        bashio::log.info "Configured for Nabu Casa access: ${SERVER_URL}"
    else
        bashio::log.warning "Nabu Casa URL not available, falling back to manual configuration"
        export SERVER_URL="$(bashio::config 'server_url')"
    fi
elif [[ "${EXTERNAL_METHOD}" == "port_forward" ]]; then
    # Port forwarding access
    export SERVER_URL="$(bashio::config 'server_url')"
    bashio::log.info "Configured for port forwarding access: ${SERVER_URL}"
elif [[ "${EXTERNAL_METHOD}" == "reverse_proxy" ]]; then
    # Reverse proxy access
    PROXY_URL="$(bashio::config 'reverse_proxy.proxy_url')"
    export SERVER_URL="${PROXY_URL}"
    bashio::log.info "Configured for reverse proxy access: ${SERVER_URL}"
else
    # Manual configuration
    export SERVER_URL="$(bashio::config 'server_url')"
    bashio::log.info "Using manual server URL configuration: ${SERVER_URL}"
fi

# Configure CORS origins based on access method
CORS_ORIGINS="$(bashio::config 'cors_origins')"
export CORS_ORIGIN="${CORS_ORIGINS}"

# OAuth redirect URI configuration
if [[ -n "${SERVER_URL}" ]]; then
    export OAUTH_REDIRECT_URI="${SERVER_URL}/oauth/callback"
    bashio::log.info "OAuth redirect URI: ${OAUTH_REDIRECT_URI}"
fi

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

# Additional environment variables
export PORT="$(bashio::config 'external_port')"
export LOG_LEVEL="$(bashio::config 'log_level')"
export DEBUG="$(bashio::config 'debug')"

# Ingress configuration
export INGRESS_URL="/api/hassio/app/ha_mcp_bridge"
export INGRESS_PORT="3003"

bashio::log.info "Starting HA MCP Bridge..."
bashio::log.info "External URL: ${SERVER_URL}"
bashio::log.info "Ingress URL: ${INGRESS_URL}"
bashio::log.info "Port: ${PORT}"

# Change to application directory and start server
cd /usr/src/app
exec node server.js
```

## 🔧 Server Code Modifications for Ingress Support

### Add to server.js for Ingress Handling
```javascript
// Ingress support configuration
const INGRESS_PATH = process.env.INGRESS_URL || '/api/hassio/app/ha_mcp_bridge';
const EXTERNAL_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 3003;

// Middleware to handle ingress requests
function handleIngressPath(req, res, next) {
  // Check if request is coming through ingress
  if (req.headers['x-ingress-path']) {
    // Adjust paths for ingress
    req.originalUrl = req.url;
    req.url = req.url.replace(INGRESS_PATH, '');
    req.ingressPath = INGRESS_PATH;
  }
  next();
}

// Add ingress middleware before other routes
app.use(handleIngressPath);

// Update OAuth redirect URIs to handle both ingress and external access
function getOAuthRedirectURI(req) {
  if (req.ingressPath) {
    // Ingress access - use HA base URL
    const haBaseUrl = req.headers['x-forwarded-host'] || req.headers.host;
    return `https://${haBaseUrl}${INGRESS_PATH}/oauth/callback`;
  } else {
    // External access - use configured external URL
    return `${EXTERNAL_URL}/oauth/callback`;
  }
}

// Update server info endpoint to include ingress information
app.get('/', (req, res) => {
  const serverInfo = {
    name: 'HA MCP Server',
    version: '1.0.0',
    description: 'Home Assistant Model Context Protocol Server',
    transport: 'streamable-http',
    protocol: '2024-11-05',
    access: {
      ingress: {
        enabled: true,
        path: INGRESS_PATH,
        available: !!req.ingressPath
      },
      external: {
        enabled: true,
        url: EXTERNAL_URL,
        available: !req.ingressPath
      }
    },
    capabilities: {
      tools: { listChanged: true },
      prompts: {}
    }
  };
  
  res.json(serverInfo);
});
```

## 🛡️ Security Considerations for External Access

### 1. Authentication Flow Updates
```javascript
// Enhanced OAuth flow for multiple access methods
function createOAuthFlow(accessMethod) {
  const config = {
    nabu_casa: {
      redirectURI: `${NABU_CASA_URL}:3003/oauth/callback`,
      trustedDomains: ['*.ui.nabu.casa', 'claude.ai']
    },
    port_forward: {
      redirectURI: `${EXTERNAL_DOMAIN}:3003/oauth/callback`,
      trustedDomains: [EXTERNAL_DOMAIN, 'claude.ai']
    },
    reverse_proxy: {
      redirectURI: `${PROXY_URL}/oauth/callback`,
      trustedDomains: [PROXY_DOMAIN, 'claude.ai']
    }
  };
  
  return config[accessMethod] || config.port_forward;
}
```

### 2. CORS Configuration for Different Access Methods
```javascript
// Dynamic CORS based on access method
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://claude.ai',
      'https://app.claude.ai',
      process.env.SERVER_URL,
      `https://${process.env.NABU_CASA_DOMAIN}`,
      process.env.INGRESS_URL
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.some(allowed => 
        origin.startsWith(allowed) || origin.includes(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
```

## 📋 User Setup Instructions

### For Nabu Casa Users (Recommended)
1. **Enable port exposure** in add-on configuration:
   ```yaml
   external_access:
     enabled: true
     method: "nabu_casa"
   nabu_casa:
     expose_port: true
   ```

2. **Use your Nabu Casa URL** in Claude.ai:
   ```
   https://your-instance-name.ui.nabu.casa:3003
   ```

3. **No router configuration needed** - Nabu Casa handles external access

### For Self-Hosted Users
1. **Configure port forwarding** on your router:
   - Internal: `192.168.1.100:3003`
   - External: `your-domain.com:3003`

2. **Update add-on configuration**:
   ```yaml
   external_access:
     enabled: true
     method: "port_forward"
   server_url: "https://your-domain.com:3003"
   ```

3. **Configure DNS** to point to your external IP

### For Advanced Users (Reverse Proxy)
1. **Configure your reverse proxy** (nginx, Apache, etc.)
2. **Update add-on configuration**:
   ```yaml
   external_access:
     enabled: true
     method: "reverse_proxy"
   reverse_proxy:
     enabled: true
     proxy_url: "https://mcp.your-domain.com"
   ```

## 🔍 Troubleshooting External Access

### Common Issues and Solutions

1. **Nabu Casa URL not working**:
   - Check if port 3003 is exposed in Nabu Casa settings
   - Verify add-on is running and accessible internally
   - Check HA logs for SSL/certificate issues

2. **Port forwarding not working**:
   - Verify router port forwarding configuration
   - Check firewall settings on HA host
   - Test internal access first

3. **SSL certificate issues**:
   - Use Let's Encrypt for automatic SSL
   - Ensure domain points to correct IP
   - Check certificate renewal status

4. **Claude.ai connection fails**:
   - Verify CORS origins include Claude.ai domains
   - Check OAuth redirect URI configuration
   - Test MCP endpoint directly in browser

---

This configuration ensures the HA MCP Bridge add-on works seamlessly with all Home Assistant access methods while maintaining security and ease of use.