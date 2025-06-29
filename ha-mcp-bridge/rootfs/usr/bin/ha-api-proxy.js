#!/usr/bin/env node

const http = require('http');
const https = require('https');
const url = require('url');

console.log('🚀 Starting HA API Proxy for Claude.ai MCP...');
console.log('🆔 ADDON IDENTITY: HA-API-PROXY-v3.0.1');
console.log('🕐 STARTUP TIME:', new Date().toISOString());

// Home Assistant API configuration
const HA_URL = process.env.HA_URL || 'http://supervisor/core';
const HA_TOKEN = process.env.SUPERVISOR_TOKEN;

console.log(`🏠 HA API URL: ${HA_URL}`);
console.log(`🔑 HA Token available: ${HA_TOKEN ? 'YES' : 'NO'}`);

// Helper function to call HA API
function callHAAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const apiUrl = `${HA_URL}/api/${endpoint}`;
    const options = {
      method: method,
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    console.log(`📡 HA API Call: ${method} ${apiUrl}`);

    const req = (HA_URL.startsWith('https') ? https : http).request(apiUrl, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          console.log(`✅ HA API Response: ${res.statusCode}`);
          resolve(result);
        } catch (error) {
          console.log(`📝 HA API Raw Response: ${body}`);
          resolve(body);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ HA API Error:`, error);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// MCP Server
const server = http.createServer(async (req, res) => {
  console.log(`📥 ${req.method} ${req.url} from ${req.headers.host}`);
  console.log(`📥 User-Agent: ${req.headers['user-agent']}`);
  
  // CORS headers for Claude.ai
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  try {
    // MCP Server Info
    if (req.method === 'GET' && path === '/') {
      const mcpInfo = {
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: {
            name: "HA API Proxy",
            version: "3.0.0"
          }
        }
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mcpInfo, null, 2));
      return;
    }
    
    // Handle MCP POST requests
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          console.log('📨 MCP Request:', JSON.stringify(request, null, 2));
          
          let result;
          
          if (request.method === 'tools/list') {
            // Return available tools
            result = {
              tools: [
                {
                  name: "get_states",
                  description: "Get all entity states from Home Assistant",
                  inputSchema: {
                    type: "object",
                    properties: {}
                  }
                },
                {
                  name: "get_lights",
                  description: "Get all light entities",
                  inputSchema: {
                    type: "object", 
                    properties: {}
                  }
                },
                {
                  name: "call_service",
                  description: "Call a Home Assistant service",
                  inputSchema: {
                    type: "object",
                    properties: {
                      domain: { type: "string", description: "Service domain (e.g., light, switch)" },
                      service: { type: "string", description: "Service name (e.g., turn_on, turn_off)" },
                      entity_id: { type: "string", description: "Entity ID to target" },
                      data: { type: "object", description: "Additional service data" }
                    },
                    required: ["domain", "service"]
                  }
                }
              ]
            };
          } else if (request.method === 'tools/call') {
            const toolName = request.params?.name;
            const args = request.params?.arguments || {};
            
            console.log(`🔧 Calling tool: ${toolName}`);
            
            if (toolName === 'get_states') {
              const states = await callHAAPI('states');
              result = {
                content: [
                  {
                    type: "text",
                    text: `Found ${states.length} entities in Home Assistant:\n\n` +
                          states.slice(0, 10).map(state => 
                            `${state.entity_id}: ${state.state} (${state.attributes.friendly_name || state.entity_id})`
                          ).join('\n') +
                          (states.length > 10 ? `\n\n... and ${states.length - 10} more entities` : '')
                  }
                ]
              };
            } else if (toolName === 'get_lights') {
              const states = await callHAAPI('states');
              const lights = states.filter(state => state.entity_id.startsWith('light.'));
              result = {
                content: [
                  {
                    type: "text",
                    text: `Found ${lights.length} lights:\n\n` +
                          lights.map(light => 
                            `${light.entity_id}: ${light.state} (brightness: ${light.attributes.brightness || 'N/A'})`
                          ).join('\n')
                  }
                ]
              };
            } else if (toolName === 'call_service') {
              const serviceData = {
                entity_id: args.entity_id,
                ...args.data
              };
              
              const serviceResult = await callHAAPI(
                `services/${args.domain}/${args.service}`,
                'POST',
                serviceData
              );
              
              result = {
                content: [
                  {
                    type: "text", 
                    text: `Service ${args.domain}.${args.service} called successfully`
                  }
                ]
              };
            } else {
              result = {
                content: [
                  {
                    type: "text",
                    text: `Unknown tool: ${toolName}`
                  }
                ]
              };
            }
          } else {
            result = { status: "ready", message: "HA API Proxy running" };
          }
          
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            result: result
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response, null, 2));
          
        } catch (error) {
          console.error('❌ Error processing MCP request:', error);
          const errorResponse = {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message: "Internal error: " + error.message
            }
          };
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(errorResponse, null, 2));
        }
      });
      return;
    }
    
    // Default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      result: {
        status: "ready",
        server: "HA API Proxy",
        version: "3.0.0",
        message: "Direct HA API access - no ingress needed"
      }
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: "2.0", 
      error: {
        code: -32603,
        message: "Server error: " + error.message
      }
    }, null, 2));
  }
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HA API Proxy running on port ${PORT}`);
  console.log(`🔗 Direct access URL: https://ha.right-api.com:${PORT}`);
  console.log(`🏠 Bypassing ingress - direct HA API calls`);
  console.log(`📡 Ready for Claude.ai MCP connections`);
});