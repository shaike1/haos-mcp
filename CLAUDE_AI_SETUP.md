# Claude.ai MCP Bridge Setup Instructions

## Step 1: Install and Start the Add-on

1. Install the "HA MCP Bridge Hybrid v2" add-on
2. Configure your admin password in the add-on settings
3. **Start the add-on** (make sure it's running, not just installed)

## Step 2: Get Your Ingress URL

**Important:** The ingress URL uses a dynamic token that changes. You cannot manually construct it.

1. Go to **Settings → Add-ons** in Home Assistant
2. Find **"HA MCP Bridge Hybrid v2"**
3. Click **"OPEN WEB UI"** button
4. **Copy the URL from your browser address bar**
   - It will look like: `https://ha.right-api.com/api/hassio_ingress/abc123def456/`
   - The `abc123def456` part is your unique ingress token

## Step 3: Configure Claude.ai MCP

1. **Download** the template file: [ha-mcp-bridge.dxt](https://raw.githubusercontent.com/shaike1/haos-mcp/main/ha-mcp-bridge.dxt)

2. **Edit the file** and replace `REPLACE_WITH_YOUR_INGRESS_URL` with your actual ingress URL from Step 2:
   ```json
   {
     "server": {
       "url": "https://ha.right-api.com/api/hassio_ingress/abc123def456",
       "auth": {
         "authorization_endpoint": "https://ha.right-api.com/api/hassio_ingress/abc123def456/oauth/authorize",
         "token_endpoint": "https://ha.right-api.com/api/hassio_ingress/abc123def456/oauth/token"
       }
     }
   }
   ```

3. **Import the .dxt file** into Claude.ai → Settings → MCP

## Step 4: Authentication

When Claude.ai connects, you'll be prompted for:
- **Username:** `admin`
- **Password:** The password you set in the add-on configuration
- **Home Assistant Token:** Go to HA Settings → Security → Long-lived access tokens → Create new token

## Troubleshooting

- **404 Error:** Make sure the add-on is **Started** and get the ingress URL through the "OPEN WEB UI" button
- **Wrong URL:** Don't try to construct the ingress URL manually - always get it from the HA interface
- **Token Expired:** If the ingress stops working, get a new URL from the "OPEN WEB UI" button

## Why Ingress URLs Are Dynamic

Home Assistant generates unique tokens for ingress access for security. These tokens:
- Cannot be manually constructed
- May change when the add-on restarts
- Must be obtained through the Home Assistant interface

This is why you need to get the real URL from the "OPEN WEB UI" button rather than trying to guess it.