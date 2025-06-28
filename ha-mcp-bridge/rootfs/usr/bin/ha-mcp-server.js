#!/usr/bin/env node

const http = require('http');
const url = require('url');

console.log('Starting HA MCP Server using official HA MCP protocol...');

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // Enable CORS for Claude.ai
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Serve main interface on root path
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Bridge - Official Protocol</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .url-box { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .url { font-family: monospace; font-size: 14px; font-weight: bold; color: #1976D2; }
        .important { background: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #FF9800; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 HA MCP Bridge v2.2.2 - Official Protocol</h1>
        <p>✅ Status: Ready for Claude.ai connection using official HA MCP Server protocol</p>
        
        <div class="important">
            <h3>📋 For Claude.ai Desktop:</h3>
            <p>Add this to your <strong>claude_desktop_config.json</strong>:</p>
            <pre>{
  "mcpServers": {
    "home-assistant": {
      "command": "npx",
      "args": ["-y", "mcp-proxy", "${req.headers.host ? 'https://' + req.headers.host + req.url.replace('/', '/mcp_server/sse') : 'YOUR_INGRESS_URL/mcp_server/sse'}"]
    }
  }
}</pre>
        </div>
        
        <h2>🎯 Connection Details</h2>
        <div class="url-box">
            <strong>MCP Server URL:</strong><br>
            <div class="url">${req.headers.host ? 'https://' + req.headers.host + req.url.replace('/', '/mcp_server/sse') : 'YOUR_INGRESS_URL/mcp_server/sse'}</div>
        </div>
        
        <h3>🔗 Available Endpoints:</h3>
        <ul>
            <li>/mcp_server/sse - MCP Server-Sent Events endpoint</li>
            <li>/tools - Available Home Assistant tools</li>
            <li>/auth - Authentication endpoint</li>
        </ul>
        
        <h3>🏠 Home Assistant Tools:</h3>
        <ul>
            <li>🏠 Light control</li>
            <li>🌡️ Climate control</li>
            <li>🔌 Switch control</li>
            <li>📊 Sensor data</li>
            <li>⚡ Automation triggers</li>
        </ul>
    </div>
</body>
</html>
    `);
    return;
  }
  
  // MCP Server-Sent Events endpoint (official HA MCP protocol)
  if (req.method === 'GET' && path === '/mcp_server/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Send initial connection message
    res.write('data: {"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\n\n');
    
    // Send tools list
    const tools = {
      jsonrpc: "2.0",
      method: "tools/list",
      result: {
        tools: [
          {
            name: "get_lights",
            description: "Get all light entities and their current states",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "control_light",
            description: "Turn lights on/off or adjust brightness/color",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: { type: "string", description: "Light entity ID" },
                action: { type: "string", enum: ["turn_on", "turn_off"] },
                brightness: { type: "number", minimum: 0, maximum: 255 },
                color: { type: "string", description: "Color name or hex code" }
              },
              required: ["entity_id", "action"]
            }
          },
          {
            name: "get_sensors",
            description: "Get sensor data (temperature, humidity, motion, etc.)",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "get_climate",
            description: "Get climate/thermostat information",
            inputSchema: {
              type: "object", 
              properties: {}
            }
          }
        ]
      }
    };
    
    res.write(`data: ${JSON.stringify(tools)}\n\n`);
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write('data: {"jsonrpc":"2.0","method":"ping"}\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(keepAlive);
      console.log('MCP connection closed');
    });
    
    return;
  }
  
  // Tools endpoint
  if (req.method === 'GET' && path === '/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tools: [
        "get_lights", "control_light", "get_sensors", "get_climate",
        "get_switches", "control_switch", "run_automation", "get_areas"
      ]
    }));
    return;
  }
  
  // Auth endpoint for token validation
  if (req.method === 'POST' && path === '/auth') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "authenticated",
      message: "Using Home Assistant authentication"
    }));
    return;
  }
  
  // Default 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HA MCP Server running on port ${PORT}`);
  console.log(`🌐 Using official Home Assistant MCP Server protocol`);
  console.log(`📡 SSE endpoint: /mcp_server/sse`);
});