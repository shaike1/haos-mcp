#!/usr/bin/env node

const http = require('http');
const url = require('url');

console.log('Starting Simple MCP Server for Claude.ai...');

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
  
  // Serve main interface on root path (for ingress)
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Bridge - Claude.ai Ready</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .url-box { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .url { font-family: monospace; font-size: 14px; font-weight: bold; color: #1976D2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 HA MCP Bridge v2.2.1 - Simple Version</h1>
        <p>✅ Status: Ready for Claude.ai connection</p>
        
        <h2>🎯 Claude.ai MCP URL</h2>
        <div class="url-box">
            <strong>Use this URL in Claude.ai:</strong><br>
            <div class="url">${req.headers.host ? 'https://' + req.headers.host + req.url : 'Your ingress URL'}</div>
        </div>
        
        <h3>Available Endpoints:</h3>
        <ul>
            <li>/.well-known/oauth-authorization-server</li>
            <li>/oauth/authorize</li>
            <li>/oauth/token</li>
        </ul>
    </div>
</body>
</html>
    `);
    return;
  }
  
  // OAuth discovery endpoint for Claude.ai
  if (req.method === 'GET' && path === '/.well-known/oauth-authorization-server') {
    const baseUrl = req.headers.host ? `https://${req.headers.host}${req.url.replace(path, '')}` : 'https://ha.right-api.com';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256']
    }));
    return;
  }
  
  // OAuth authorize endpoint
  if (req.method === 'GET' && path === '/oauth/authorize') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head><title>HA MCP Bridge - Login</title></head>
<body>
    <h1>Authorize Claude.ai Access</h1>
    <form method="post" action="/oauth/authorize">
        <input type="hidden" name="client_id" value="${parsedUrl.query.client_id || 'claude-ai-client'}">
        <input type="hidden" name="response_type" value="${parsedUrl.query.response_type || 'code'}">
        <input type="hidden" name="redirect_uri" value="${parsedUrl.query.redirect_uri || ''}">
        <input type="hidden" name="state" value="${parsedUrl.query.state || ''}">
        <input type="hidden" name="code_challenge" value="${parsedUrl.query.code_challenge || ''}">
        <input type="hidden" name="code_challenge_method" value="${parsedUrl.query.code_challenge_method || 'S256'}">
        
        <label>Username: <input type="text" name="username" value="admin" required></label><br><br>
        <label>Password: <input type="password" name="password" required></label><br><br>
        <button type="submit">Authorize</button>
    </form>
</body>
</html>
    `);
    return;
  }
  
  // OAuth token endpoint
  if (req.method === 'POST' && path === '/oauth/token') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      access_token: 'mcp-bridge-token-' + Date.now(),
      token_type: 'bearer',
      expires_in: 3600,
      scope: 'mcp'
    }));
    return;
  }
  
  // Default 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple MCP Server running on port ${PORT}`);
  console.log(`🌐 Access via Home Assistant ingress`);
});