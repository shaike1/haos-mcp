# HA MCP Bridge Add-on

## About

The HA MCP Bridge add-on provides a Model Context Protocol (MCP) server that allows Claude.ai to interact directly with your Home Assistant installation. This add-on enables Claude.ai to control devices, read sensors, and manage automations through a secure OAuth 2.1 authentication flow.

## Installation

1. Navigate to **Settings** → **Add-ons** → **Add-on Store** in your Home Assistant interface
2. Click the **⋮** menu and select **Repositories**
3. Add this repository URL: `https://github.com/shaike1/ha-mcp-addon`
4. Find "HA MCP Bridge" in the add-on store and click **Install**
5. Wait for the installation to complete

## Configuration

### Basic Options

- **server_url**: The external URL where Claude.ai can reach your MCP server (e.g., `https://your-domain.com`)
- **external_port**: Port for external access (default: 3003)
- **log_level**: Logging verbosity (debug, info, warning, error)
- **debug**: Enable debug mode for troubleshooting

### OAuth Authentication

- **enable**: Enable OAuth authentication (recommended: true)
- **admin_username**: Admin username for the OAuth flow
- **admin_password**: Admin password (**Change from default!**)

### Home Assistant Integration

- **use_supervisor_token**: Use Home Assistant supervisor token for API access (recommended: true)
- **external_ha_url**: Custom Home Assistant URL (only if not using supervisor token)
- **external_ha_token**: Custom Home Assistant token (only if not using supervisor token)

### Performance Settings

- **request_timeout**: HTTP request timeout in milliseconds (default: 60000)
- **keepalive_timeout**: Keep-alive timeout in milliseconds (default: 65000)
- **sse_ping_interval**: Server-Sent Events ping interval in milliseconds (default: 8000)

### CORS Configuration

- **cors_origins**: List of allowed origins for Cross-Origin Resource Sharing
  - Default includes: `https://claude.ai`, `https://app.claude.ai`

## Usage

### Setting up Claude.ai

1. Start the add-on after configuration
2. Note the external URL (e.g., `https://your-domain.com:3003`)
3. In Claude.ai, add the MCP server:
   - Server URL: Your external URL
   - Follow the OAuth authentication flow
   - Grant necessary permissions

### Available Tools

Once connected, Claude.ai will have access to these Home Assistant tools:

#### Device Control
- **get_entities**: List all entities or filter by domain
- **call_service**: Control devices via Home Assistant services
- **get_lights**: Get all light entities with current states
- **get_switches**: Get all switch entities
- **control_lights**: Advanced light control with brightness and color

#### Climate & Environment
- **get_climate**: Get climate/HVAC information and controls
- **get_sensors**: Monitor various sensors (temperature, presence, motion, water leak)
- **get_temperature_simple**: Quick temperature reading (optimized for performance)

#### Automation & Management
- **get_automations**: List all Home Assistant automations
- **test_simple**: Connectivity test tool

### Example Commands for Claude.ai

- "Turn on the living room lights"
- "What's the temperature in the bedroom?"
- "Check if any water leak sensors are triggered"
- "Set the thermostat to 22 degrees"
- "Show me all the motion sensors"
- "Turn off all lights in the house"

## Security

### Important Security Notes

1. **Change Default Password**: Always change the default admin password before exposing externally
2. **Use HTTPS**: Configure HTTPS for external access to protect authentication
3. **Monitor Access**: Check logs regularly for unauthorized access attempts
4. **Rotate Credentials**: Periodically update OAuth credentials and tokens

### Network Security

- The add-on uses OAuth 2.1 with PKCE for secure authentication
- All API calls require valid authentication tokens
- CORS is configured to only allow Claude.ai domains by default
- Session persistence prevents frequent re-authentication

## Troubleshooting

### Add-on Won't Start

1. Check the add-on logs for error messages
2. Verify configuration syntax in the add-on options
3. Ensure external_port is not in use by another service
4. Check Home Assistant system resources

### Claude.ai Can't Connect

1. Verify the server_url is accessible from the internet
2. Check firewall settings and port forwarding
3. Ensure HTTPS is properly configured if using SSL
4. Verify OAuth credentials are correct

### Tools Not Working

1. Check if supervisor token is properly configured
2. Verify Home Assistant API is accessible
3. Review timeout settings if responses are slow
4. Check entity permissions and availability

### Performance Issues

1. Increase timeout values if experiencing slow responses
2. Check Home Assistant system load
3. Monitor network latency to external services
4. Review log_level setting (debug mode can be verbose)

## Advanced Configuration

### External Home Assistant

If your Home Assistant is on a different server:
```yaml
ha_integration:
  use_supervisor_token: false
  external_ha_url: "https://your-ha-server.com"
  external_ha_token: "your_long_lived_access_token"
```

### Custom Timeout Settings

For slower networks or systems:
```yaml
timeouts:
  request_timeout: 120000    # 2 minutes
  keepalive_timeout: 130000  # 2 minutes 10 seconds
  sse_ping_interval: 15000   # 15 seconds
```

### Debug Mode

For troubleshooting:
```yaml
log_level: "debug"
debug: true
```

## Support

- **Documentation**: See the main repository for detailed technical information
- **Issues**: Report problems at https://github.com/shaike1/ha-mcp-addon/issues
- **Discussions**: Community support and questions

## Changelog

### Version 1.0.0
- Initial release as Home Assistant Add-on
- Full MCP protocol support for Claude.ai
- OAuth 2.1 authentication with PKCE
- Comprehensive device and sensor control
- Optimized for performance and stability