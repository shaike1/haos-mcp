#!/usr/bin/env node

const http = require('http');

console.log('🔥 UNIVERSAL MCP SERVER - SERVES ON ALL PATHS');
console.log('🆔 IDENTITY: UNIVERSAL-MCP-v3.2.0');
console.log('🕐 START:', new Date().toISOString());

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`📥 [${timestamp}] ${req.method} ${req.url}`);
  console.log(`📥 Host: ${req.headers.host}`);
  console.log(`📥 User-Agent: ${req.headers['user-agent']}`);
  console.log(`📥 Origin: ${req.headers.origin}`);
  console.log(`📥 Accept: ${req.headers.accept}`);
  
  // Universal CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Powered-By', 'UNIVERSAL-MCP-v3.2.0');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Check if client wants SSE (Claude.ai remote MCP)
  const wantsSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
  const isMCPClient = req.headers['user-agent'] && (
    req.headers['user-agent'].includes('claude') ||
    req.headers['user-agent'].includes('mcp') ||
    req.headers['user-agent'].toLowerCase().includes('anthropic')
  );
  
  console.log(`🔍 Wants SSE: ${wantsSSE}, Is MCP Client: ${isMCPClient}`);
  
  // Serve SSE for any client that requests it or looks like MCP client
  if (wantsSSE || isMCPClient || req.url.includes('sse')) {
    console.log('🌊 Serving SSE MCP response');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.writeHead(200);
    
    // Send MCP server initialization
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
          name: "Universal HA MCP",
          version: "3.2.0"
        }
      }
    };
    
    res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);
    console.log('✅ SSE MCP connection established');
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(`data: {"type":"ping","timestamp":"${new Date().toISOString()}"}\n\n`);
    }, 30000);
    
    req.on('close', () => {
      console.log('🔌 SSE client disconnected');
      clearInterval(keepAlive);
    });
    
    return;
  }
  
  // Default: Serve JSON MCP for everything else
  console.log('🎯 Serving JSON MCP response');
  
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
        name: "Universal HA MCP",
        version: "3.2.0",
        timestamp: timestamp
      },
      message: "✅ Universal MCP server - serves both SSE and JSON",
      request: {
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          accept: req.headers.accept,
          origin: req.headers.origin
        }
      }
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify(mcpResponse, null, 2));
  console.log('✅ JSON MCP response sent');
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ UNIVERSAL MCP SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔥 RESPONDS TO ALL PATHS WITH MCP CONTENT`);
  console.log(`🌊 Auto-detects SSE vs JSON based on client headers`);
  console.log(`📡 Compatible with Claude.ai remote MCP`);
});