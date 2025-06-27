ARG BUILD_FROM
FROM $BUILD_FROM

# Force rebuild with timestamp
RUN echo "Build timestamp: $(date)" > /build-info.txt

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

# Copy run script and make executable
COPY rootfs /
RUN chmod +x /usr/bin/run.sh

# Create app user for security
RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
RUN chown -R app:app /app
USER app

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