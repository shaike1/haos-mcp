#!/usr/bin/env node

const http = require('http');
const url = require('url');

console.log('🚀 Starting JSON MCP Server for Claude.ai...');

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  console.log(`📥 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📥 Origin:`, req.headers.origin);
  console.log(`📥 User-Agent:`, req.headers['user-agent']);
  
  // Enable CORS for Claude.ai web interface
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // MCP Server Info - JSON response
  if (req.method === 'GET' && (path === '/' || path === '')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: "HA MCP Bridge",
          version: "2.3.1"
        }
      }
    }));
    return;
  }
  
  // Tools list - JSON response
  if (req.method === 'POST' && path === '/tools/list') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
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
                brightness: { type: "number", minimum: 0, maximum: 255 }
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
          },
          {
            name: "control_switch",
            description: "Turn switches on or off",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: { type: "string", description: "Switch entity ID" },
                action: { type: "string", enum: ["turn_on", "turn_off"] }
              },
              required: ["entity_id", "action"]
            }
          }
        ]
      }
    }));
    return;
  }
  
  // Tool execution - JSON response
  if (req.method === 'POST' && path === '/tools/call') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        const toolName = request.params?.name;
        
        // Mock responses for now
        let result;
        switch (toolName) {
          case 'get_lights':
            result = {
              lights: [
                { entity_id: "light.living_room", state: "on", brightness: 255 },
                { entity_id: "light.bedroom", state: "off", brightness: 0 }
              ]
            };
            break;
          case 'get_sensors':
            result = {
              sensors: [
                { entity_id: "sensor.temperature", state: "22.5", unit: "°C" },
                { entity_id: "sensor.humidity", state: "45", unit: "%" }
              ]
            };
            break;
          default:
            result = { status: "success", message: `Tool ${toolName} executed` };
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error"
          }
        }));
      }
    });
    return;
  }
  
  // Default JSON response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: "2.0",
    result: {
      status: "ready",
      server: "HA MCP Bridge",
      version: "2.3.1",
      endpoints: ["/", "/tools/list", "/tools/call"]
    }
  }));
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ JSON MCP Server running on port ${PORT}`);
  console.log(`🔗 MCP Protocol: 2024-11-05`);
  console.log(`📡 Ready for Claude.ai JSON requests`);
});