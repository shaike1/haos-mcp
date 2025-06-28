#!/usr/bin/env node

const http = require('http');

console.log('🚀 Starting Minimal MCP Server for ingress testing...');

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  console.log(`📥 Host: ${req.headers.host}`);
  console.log(`📥 User-Agent: ${req.headers['user-agent']}`);
  
  // Set headers for all responses
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Serve content on ANY path for ingress compatibility
  res.writeHead(200);
  res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Bridge - Ingress Test</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f0f8ff;
            line-height: 1.6;
        }
        .container { 
            max-width: 800px;
            margin: 0 auto;
            background: white; 
            padding: 30px; 
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .success { 
            background: #d4edda; 
            color: #155724;
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
            border-left: 5px solid #28a745;
        }
        .url-box { 
            background: #e3f2fd; 
            padding: 20px; 
            border-radius: 5px; 
            margin: 20px 0;
            border-left: 5px solid #2196F3;
        }
        .code { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 5px; 
            font-family: monospace;
            margin: 10px 0;
            overflow-x: auto;
        }
        .highlight { 
            background: yellow; 
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 SUCCESS! HA MCP Bridge v2.2.4</h1>
        
        <div class="success">
            <h2>✅ Ingress is Working!</h2>
            <p>If you can see this page, the Home Assistant ingress routing is working correctly.</p>
        </div>
        
        <div class="url-box">
            <h3>🎯 Your Claude.ai MCP URL:</h3>
            <div class="code">
                <strong class="highlight">${req.headers.host ? 'https://' + req.headers.host + req.url : 'Current URL'}</strong>
            </div>
            <p><strong>For Claude Desktop, use this exact URL above.</strong></p>
        </div>
        
        <div class="url-box">
            <h3>📱 Claude Desktop Configuration:</h3>
            <p>Add this to your <strong>claude_desktop_config.json</strong>:</p>
            <div class="code">
{
  "mcpServers": {
    "home-assistant": {
      "command": "node",
      "args": ["-e", "
        const http = require('http');
        const url = '${req.headers.host ? 'https://' + req.headers.host + req.url : 'YOUR_URL_HERE'}';
        console.log('Connecting to:', url);
        // Simple MCP client implementation
        setInterval(() => console.log('MCP ping'), 5000);
      "]
    }
  }
}
            </div>
        </div>
        
        <h3>🔍 Request Info:</h3>
        <div class="code">
            URL: ${req.url}<br>
            Method: ${req.method}<br>
            Host: ${req.headers.host || 'Not set'}<br>
            Time: ${new Date().toISOString()}
        </div>
        
        <h3>📋 Next Steps:</h3>
        <ol>
            <li><strong>Copy the highlighted URL above</strong></li>
            <li><strong>Use it in Claude.ai</strong> or Claude Desktop</li>
            <li><strong>Test the connection</strong></li>
        </ol>
        
        <p><em>This minimal server proves ingress routing works. Now we can build the full MCP functionality on top of this foundation.</em></p>
    </div>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal MCP Server running on port ${PORT}`);
  console.log(`🌐 Ready for ingress connections`);
  console.log(`📡 Will serve content on ALL paths for maximum compatibility`);
});