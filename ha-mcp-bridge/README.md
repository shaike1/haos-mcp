# HA MCP Bridge Add-on

![Version](https://img.shields.io/badge/version-1.0.5-blue.svg)
![Supports aarch64](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64](https://img.shields.io/badge/amd64-yes-green.svg)
![Supports armhf](https://img.shields.io/badge/armhf-yes-green.svg)
![Supports armv7](https://img.shields.io/badge/armv7-yes-green.svg)
![Supports i386](https://img.shields.io/badge/i386-yes-green.svg)

**Model Context Protocol server for Claude.ai integration with Home Assistant**

Transform your Home Assistant into an MCP server that Claude.ai can connect to, enabling natural language control of your smart home devices.

## 🚀 Quick Start

### 1. Install the Add-on
1. Navigate to **Settings** → **Add-ons** → **Add-on Store** in Home Assistant
2. Install "HA MCP Bridge" 
3. Go to **Configuration** tab and set a strong admin password
4. **Start** the add-on

### 2. Get Your Connection URL
After starting the add-on:
1. **Check the Logs tab** - your external URL will be displayed like this:
   ```
   ✅ External URL: https://abc123.ui.nabu-casa.com:3003
   ```
2. **Copy this exact URL** - you'll need it for Claude.ai
3. **Available for copy-paste** directly from the logs

### 3. Connect Claude.ai
1. Open **Claude.ai** → **Settings** → **Feature Preview**
2. Enable **Model Context Protocol** 
3. Click **Add MCP Server**
4. **Paste your URL** from step 2 (e.g., `https://abc123.ui.nabu-casa.com:3003`)
5. Complete OAuth authentication when prompted

## 🔧 How It Works

### **Internal Home Assistant Access (Automatic)**
- ✅ **No setup required**: Add-on automatically connects to Home Assistant
- ✅ **Uses Supervisor Token**: Secure internal API access 
- ✅ **Full device access**: Controls all your entities automatically
- ✅ **Local communication**: Add-on ↔ Home Assistant (internal network)

### **External Claude.ai Access**
- 🌐 **Nabu Casa** (recommended): Automatic SSL and external access
- 🔧 **Port Forwarding**: Manual router setup required
- 🛡️ **OAuth 2.1**: Secure authentication with PKCE
- 🔐 **CORS Protected**: Only Claude.ai domains allowed

## 🎯 Features

- 🏠 **Complete Device Control**: Lights, switches, climate systems, sensors
- 🔐 **Secure Authentication**: OAuth 2.1 with PKCE for safe external access
- 🌐 **Nabu Casa Integration**: Automatic URL detection and SSL handling
- ⚡ **Performance Optimized**: Timeout settings tuned for Claude.ai stability
- 📊 **Comprehensive Monitoring**: Temperature, motion, presence, water leak sensors
- 🛡️ **Security First**: Supervisor token integration and CORS protection

## 📋 Configuration Options

- **Admin Password**: Set a strong password for OAuth authentication
- **Log Level**: Choose debug, info, warning, or error
- **External Access Method**: 
  - `nabu_casa` - Use Nabu Casa (recommended)
  - `port_forward` - Manual port forwarding
  - `reverse_proxy` - Use your own reverse proxy

## 🔍 Finding Your Connection URL

**The add-on will show your URL in the Logs tab after starting:**

### **Nabu Casa Users**
```
[INFO] External URL: https://abc123.ui.nabu-casa.com:3003
```
👆 **Copy this exact URL** to use in Claude.ai

### **Self-Hosted Users**
```
[INFO] External URL: https://your-domain.com:3003
```
👆 **Copy this URL** (make sure port 3003 is forwarded)

## 🛠️ Troubleshooting

**Add-on won't start?**
- Check you've set a strong admin password
- Verify port 3003 isn't used by another service

**Claude.ai can't connect?**
- Ensure your external URL is accessible from the internet
- Check firewall allows port 3003
- Verify SSL certificate is valid

**OAuth authentication fails?**
- Double-check your admin password
- Try using incognito/private browser mode
- Ensure system time is synchronized

## 📞 Support

- **Issues**: [Report problems](https://github.com/shaike1/haos-mcp/issues)
- **Source Code**: [GitHub Repository](https://github.com/shaike1/ha-mcp-bridge)

## 📄 License

MIT License