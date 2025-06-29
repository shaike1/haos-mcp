#!/usr/bin/env node

const http = require('http');
const url = require('url');

console.log('🌊 SSE MCP SERVER - Home Assistant Compatible');
console.log('🆔 IDENTITY: SSE-MCP-v3.1.0');
console.log('🕐 START:', new Date().toISOString());

// HA API configuration
const HA_URL = process.env.HA_URL || 'http://supervisor/core';
const HA_TOKEN = process.env.SUPERVISOR_TOKEN;

console.log(`🏠 HA URL: ${HA_URL}`);
console.log(`🔑 Token: ${HA_TOKEN ? 'AVAILABLE' : 'MISSING'}`);

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  console.log(`📥 [${timestamp}] ${req.method} ${path}`);
  console.log(`📥 Host: ${req.headers.host}`);
  console.log(`📥 User-Agent: ${req.headers['user-agent']}`);
  
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    res.writeHead(200);
    res.end();
    return;
  }
  
  // MCP Server SSE endpoint (like official HA integration)
  // Handle ANY path - universal MCP server
  if (path.includes('/mcp_server/sse') || path === '/mcp_server/sse' || path === '/mcp_server/sse/' || req.method === 'GET') {
    console.log('🌊 SSE MCP endpoint accessed');
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.writeHead(200);
    
    // Send initial MCP server info
    const serverInfo = {
      jsonrpc: "2.0",
      method: "notifications/initialized", 
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: "Home Assistant MCP Bridge",
          version: "3.1.0"
        }
      }
    };
    
    res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);
    console.log('✅ SSE connection established');
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write('data: {"type":"ping"}\n\n');
    }, 30000);
    
    // Handle client disconnect
    req.on('close', () => {
      console.log('🔌 SSE client disconnected');
      clearInterval(keepAlive);
    });
    
    return;
  }
  
  // Regular MCP HTTP endpoint (fallback)
  if (req.method === 'GET' && (path === '/' || path === '/mcp')) {
    console.log('🎯 HTTP MCP endpoint accessed');
    
    const mcpResponse = {
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: "Home Assistant MCP Bridge",
          version: "3.1.0"
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(mcpResponse, null, 2));
    console.log('✅ HTTP MCP response sent');
    return;
  }
  
  // Handle MCP POST requests
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        console.log('📨 MCP Request:', request.method);
        
        let result = { status: "ready", message: "MCP server running" };
        
        if (request.method === 'tools/list') {
          result = {
            tools: [
              {
                name: "test_connection",
                description: "Test Home Assistant connection",
                inputSchema: {
                  type: "object",
                  properties: {}
                }
              }
            ]
          };
        }
        
        const response = {
          jsonrpc: "2.0",
          id: request.id,
          result: result
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(response, null, 2));
        console.log('✅ MCP POST response sent');
        
      } catch (error) {
        console.error('❌ Error processing MCP request:', error);
        res.writeHead(400);
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" }
        }));
      }
    });
    return;
  }
  
  // Default response
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify({
    message: "SSE MCP Server running",
    endpoints: ["/mcp_server/sse", "/mcp", "/"],
    version: "3.1.0"
  }));
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SSE MCP SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌊 SSE Endpoint: /mcp_server/sse`);
  console.log(`🔗 HTTP Endpoint: /mcp`);
  console.log(`📡 Compatible with Claude.ai remote MCP`);
});