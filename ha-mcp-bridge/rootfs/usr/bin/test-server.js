#!/usr/bin/env node

// Ultra-simple test server to verify addon is running
const http = require('http');

console.log('🧪 TEST SERVER STARTING...');

const server = http.createServer((req, res) => {
  console.log(`TEST: ${req.method} ${req.url} from ${req.headers.host}`);
  
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🧪 TEST SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🧪 If you see HA frontend instead of this, ingress routing is broken`);
});