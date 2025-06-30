# Changelog

All notable changes to this Home Assistant add-on will be documented in this file.

## [1.0.0] - 2025-06-27

### Added
- Initial release as Home Assistant Add-on
- Full Model Context Protocol (MCP) server implementation
- OAuth 2.1 authentication with PKCE support
- Home Assistant Supervisor API integration
- Native add-on configuration schema
- Ingress support for secure web UI access
- Multi-architecture container support (aarch64, amd64, armhf, armv7, i386)

### Features
- **Device Control Tools**:
  - `get_entities` - Entity discovery and filtering
  - `call_service` - Universal service calling
  - `get_lights` / `control_lights` - Advanced lighting control
  - `get_switches` - Switch management
  - `get_climate` - Climate system control

- **Sensor Monitoring Tools**:
  - `get_sensors` - Multi-type sensor monitoring (temperature, motion, presence, water leak)
  - `get_temperature_simple` - Optimized temperature readings

- **System Management Tools**:
  - `get_automations` - Automation status and management
  - `test_simple` - Connection and health testing

### Performance Optimizations
- Connection timeout optimizations for Claude.ai stability
- 8-second SSE ping intervals for reliable tool discovery
- 30-second HA API timeouts for system reliability
- Response size optimizations for web UI compatibility

### Security Features
- OAuth 2.1 with PKCE for secure external access
- Session persistence with automatic cleanup
- CORS configuration for Claude.ai domains
- Supervisor token integration for enhanced security

### Documentation
- Comprehensive add-on documentation (DOCS.md)
- Installation and configuration guide
- Troubleshooting section
- Security best practices
- Advanced configuration examples

## Migration from Standalone Version

This add-on is based on the proven standalone HA MCP Bridge server, bringing all functionality into the Home Assistant add-on ecosystem:

- **Preserved**: All existing MCP tools and optimizations
- **Enhanced**: Native HA integration and configuration UI
- **Improved**: Supervisor API access and security model
- **Simplified**: One-click installation and updates

## Technical Details

- **Base Image**: Home Assistant add-on base with Node.js
- **Source Repository**: https://github.com/shaike1/ha-mcp-bridge
- **Container Registry**: GitHub Container Registry
- **Supported Architectures**: aarch64, amd64, armhf, armv7, i386

## Known Issues

- None at initial release

## Upcoming Features

- Enhanced automation control tools
- Extended sensor type support
- Advanced scene management
- Energy monitoring integration

---

For detailed technical information and development history, see the main repository: https://github.com/shaike1/ha-mcp-bridge