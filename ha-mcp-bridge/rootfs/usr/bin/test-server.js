#!/usr/bin/env node

// Ultra-simple test server to verify addon is running
const http = require('http');

console.log('🧪 TEST SERVER STARTING...');

const server = http.createServer((req, res) => {
  console.log(`TEST: ${req.method} ${req.url} from ${req.headers.host}`);
  console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
  
  // Anti-frame headers for Claude.ai direct access
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Serve JSON for Claude.ai MCP if requested  
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "HA MCP Bridge", version: "2.4.5" },
        message: "✅ MCP server responding directly to Claude.ai"
      }
    }, null, 2));
    return;
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(200);
  res.end(`
    <html>
    <head><title>HA MCP Bridge Test</title></head>
    <body>
        <h1>✅ ADDON IS RUNNING!</h1>
        <p>Time: ${new Date().toISOString()}</p>
        <p>URL: ${req.url}</p>
        <p>Method: ${req.method}</p>
        <p>Host: ${req.headers.host}</p>
        <h2>MCP JSON Test:</h2>
        <pre>${JSON.stringify({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "HA MCP Bridge", version: "TEST" }
          }
        }, null, 2)}</pre>
    </body>
    </html>
  `);
});

const PORT = 3003;
const HOST = '0.0.0.0'; // Listen on all interfaces for ingress

server.listen(PORT, HOST, () => {
  console.log(`🧪 TEST SERVER RUNNING ON ${HOST}:${PORT}`);
  console.log(`🧪 Configured for Home Assistant ingress`);
  console.log(`🧪 If you see HA frontend, ingress routing is broken`);
  console.log(`🧪 Expected ingress from HA internal network: 172.30.32.2`);
});