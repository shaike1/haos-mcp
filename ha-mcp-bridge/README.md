# Home Assistant Add-on: HA MCP Bridge

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]

A Home Assistant add-on that provides a Model Context Protocol (MCP) server, enabling Claude.ai to directly control your Home Assistant devices and read sensor data.

## About

This add-on transforms your Home Assistant into an MCP server that Claude.ai can connect to, allowing natural language control of your smart home. Through a secure OAuth 2.1 authentication flow, Claude.ai gains access to:

- 🏠 **Device Control**: Lights, switches, climate systems
- 📊 **Sensor Monitoring**: Temperature, motion, presence, water leak detection  
- 🤖 **Automation Management**: View and understand your automations
- 🔧 **Real-time Communication**: Optimized for Claude.ai's web interface

## Features

- **Full MCP Protocol Support**: Compatible with Claude.ai's latest integrations
- **Secure Authentication**: OAuth 2.1 with PKCE for safe external access
- **Home Assistant Integration**: Native supervisor token support
- **Performance Optimized**: Timeout settings tuned for stable Claude.ai connections
- **Comprehensive Tool Set**: 14 different tools for complete home control
- **Real-time Updates**: Server-Sent Events for instant tool discovery

## Installation

1. Navigate to the **Add-on Store** in your Home Assistant
2. Add this repository: `https://github.com/shaike1/ha-mcp-addon`
3. Install the "HA MCP Bridge" add-on
4. Configure the add-on options
5. Start the add-on

## Quick Start

1. **Configure the add-on**:
   ```yaml
   server_url: "https://your-domain.com"
   oauth:
     admin_password: "your-secure-password"
   ```

2. **Start the add-on** and note the external URL

3. **Connect Claude.ai**:
   - Add MCP server with your external URL
   - Complete OAuth authentication
   - Start controlling your home with natural language!

## Available Tools

### Device Control
- `get_entities` - List all entities or filter by domain
- `call_service` - Control any Home Assistant service
- `get_lights` / `control_lights` - Advanced lighting control
- `get_switches` - Switch management
- `get_climate` - Climate system control

### Sensor Monitoring  
- `get_sensors` - Monitor temperature, motion, presence, water leak sensors
- `get_temperature_simple` - Quick temperature readings

### System Management
- `get_automations` - View automation status
- `test_simple` - Connection testing

## Configuration

See the **Documentation** tab for detailed configuration options including:
- OAuth authentication setup
- Home Assistant integration methods
- Performance tuning options
- Security considerations

## Example Usage with Claude.ai

Once configured, you can use natural language with Claude.ai:

- *"Turn on the living room lights at 50% brightness"*
- *"What's the temperature in all rooms?"*
- *"Check if any water leak sensors are triggered"*
- *"Set the thermostat to heat mode at 22 degrees"*
- *"Turn off all lights and lock the doors"*

## Support

- 📖 **Documentation**: Complete setup guide in the Documentation tab
- 🐛 **Issues**: Report problems on [GitHub Issues][issues]
- 💬 **Discussions**: Community support and feature requests

## Links

- **Source Repository**: https://github.com/shaike1/ha-mcp-bridge
- **Add-on Repository**: https://github.com/shaike1/ha-mcp-addon
- **Home Assistant Community**: [Community Forum][community]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[issues]: https://github.com/shaike1/ha-mcp-addon/issues
[community]: https://community.home-assistant.io