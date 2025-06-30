ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    wget \
    curl \
    git

# Set working directory
WORKDIR /usr/src/app

# Clone the source repository
RUN git clone https://github.com/shaike1/ha-mcp-bridge.git . && \
    npm ci --only=production && \
    npm cache clean --force

# Copy add-on specific files
COPY rootfs /

# Set permissions
RUN chmod a+x /usr/bin/run.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

# Labels
LABEL \
  io.hass.name="HA MCP Bridge" \
  io.hass.description="Model Context Protocol server for Home Assistant" \
  io.hass.type="addon" \
  io.hass.version="1.0.0"

# The container will run the start script
CMD ["/usr/bin/run.sh"]