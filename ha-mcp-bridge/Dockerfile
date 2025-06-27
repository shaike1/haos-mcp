ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    jq \
    curl

# Set working directory
WORKDIR /usr/src/app

# Copy package.json first
COPY package.json ./

# Install dependencies 
RUN npm install --production

# Copy the local MCP server file
COPY rootfs/usr/bin/mcp-server.js ./server.js

# Make server executable
RUN chmod +x ./server.js

# Copy run script
COPY rootfs /

# Make run script executable
RUN chmod +x /usr/bin/run.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Labels
LABEL \
    io.hass.name="HA MCP Bridge" \
    io.hass.description="Model Context Protocol server for Home Assistant integration with Claude.ai" \
    io.hass.arch="armhf|aarch64|i386|amd64|armv7" \
    io.hass.type="addon" \
    io.hass.version="1.0.6"

# Set entrypoint
ENTRYPOINT ["/usr/bin/run.sh"]