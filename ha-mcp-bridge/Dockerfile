ARG BUILD_FROM
FROM $BUILD_FROM

# Force complete rebuild - v2.3.8 Dynamic Token Detection  
RUN echo "FORCE-REBUILD-$(date +%s)-$(uuidgen)" > /cache-break.txt
RUN echo "Build: v2.3.8 Dynamic Token Detection" > /build-info.txt
RUN echo "Container cache break: $(uuidgen)" > /force-update.txt
RUN echo "Timestamp: $(date)" > /build-timestamp.txt

# Install Node.js and dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    jq \
    curl

# Set working directory
WORKDIR /app

# Copy package.json first
COPY package.json ./

# Install dependencies 
RUN npm install --production && npm cache clean --force

# Copy the enhanced MCP server
COPY rootfs/usr/bin/mcp-server.js ./server.js

# Copy rootfs structure for S6 overlay
COPY rootfs /

# Ensure proper permissions for Home Assistant add-on
RUN chown -R root:root /app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Labels
LABEL \
    io.hass.name="HA MCP Bridge" \
    io.hass.description="Hybrid MCP server with add-on + integration capabilities for Claude.ai" \
    io.hass.arch="armhf|aarch64|i386|amd64|armv7" \
    io.hass.type="addon" \
    io.hass.version="2.2.0"

# Use default S6 overlay entrypoint