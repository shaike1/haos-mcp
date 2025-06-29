#!/usr/bin/env node

const http = require('http');

console.log('🔥 MINIMAL MCP SERVER - UNIVERSAL PATH HANDLER');
console.log('🆔 IDENTITY: MINIMAL-MCP-v3.0.3');
console.log('🕐 START:', new Date().toISOString());

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`📥 [${timestamp}] ${req.method} ${req.url}`);
  console.log(`📥 Host: ${req.headers.host}`);
  console.log(`📥 User-Agent: ${req.headers['user-agent']}`);
  
  // UNIVERSAL CORS - allow everything
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Powered-By', 'MINIMAL-MCP-v3.0.3');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight handled');
    res.writeHead(200);
    res.end();
    return;
  }
  
  // SERVE MCP JSON ON ANY REQUEST
  console.log('🎯 Serving MCP JSON response');
  
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
        name: "Minimal HA MCP",
        version: "3.0.3",
        timestamp: timestamp
      },
      message: "✅ MCP server responding from Home Assistant addon",
      debug: {
        url: req.url,
        method: req.method,
        host: req.headers.host
      }
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify(mcpResponse, null, 2));
  
  console.log('✅ MCP JSON response sent');
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MINIMAL MCP SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔗 UNIVERSAL PATH HANDLER - RESPONDS TO ANY REQUEST`);
  console.log(`📡 READY FOR CLAUDE.AI MCP CONNECTIONS`);
});