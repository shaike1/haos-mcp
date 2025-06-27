# HA MCP Bridge Add-on

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Supports aarch64](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64](https://img.shields.io/badge/amd64-yes-green.svg)
![Supports armhf](https://img.shields.io/badge/armhf-yes-green.svg)
![Supports armv7](https://img.shields.io/badge/armv7-yes-green.svg)
![Supports i386](https://img.shields.io/badge/i386-yes-green.svg)

Model Context Protocol server for Claude.ai integration with Home Assistant.

Transform your Home Assistant into an MCP server that Claude.ai can connect to, enabling natural language control of your smart home devices.

## Features

- 🏠 **Complete Device Control**: Lights, switches, climate systems, sensors
- 🔐 **Secure Authentication**: OAuth 2.1 with PKCE for safe external access
- 🌐 **Nabu Casa Integration**: Automatic URL detection and SSL handling
- ⚡ **Performance Optimized**: Timeout settings tuned for Claude.ai stability
- 📊 **Comprehensive Monitoring**: Temperature, motion, presence, water leak sensors
- 🛡️ **Security First**: Supervisor token integration and CORS protection

## Installation

1. Add this repository to your Home Assistant add-on store
2. Install the "HA MCP Bridge" add-on
3. Configure your external access method (Nabu Casa recommended)
4. Start the add-on and note the external URL
5. Add the URL to Claude.ai as an MCP server
6. Authenticate and start controlling your home with natural language!

## Configuration

See the add-on configuration tab for detailed setup options.

## Support

- **Issues**: [Report problems](https://github.com/shaike1/ha-mcp-bridge/issues)
- **Discussions**: [Community support](https://github.com/shaike1/ha-mcp-bridge/discussions)
- **Source Code**: [GitHub Repository](https://github.com/shaike1/ha-mcp-bridge)

## License

MIT License - see the source repository for details.