# Repository Setup Instructions for shaike1

This document provides step-by-step instructions for setting up the HA MCP add-on repositories.

## 📤 Step 1: Backup to GitHub (Manual Steps)

Since git authentication needs to be done manually, follow these steps:

### 1.1 Create GitHub Repository
1. Go to https://github.com/new
2. Create repository: `ha-mcp-addon`
3. Set as **Public** (required for HA Community Store)
4. **Don't initialize** with README (we have existing code)

### 1.2 Push Code to GitHub
```bash
# You'll need to do this manually from your local machine or configure git authentication
cd /root/ha-mcp/ha-mcp-addon

# Option 1: Use GitHub CLI (if installed)
gh auth login
git remote add origin https://github.com/shaike1/ha-mcp-addon.git
git push -u origin main

# Option 2: Use Personal Access Token
# Generate token at: https://github.com/settings/tokens
git remote add origin https://github.com/shaike1/ha-mcp-addon.git
# When prompted for password, use your Personal Access Token
git push -u origin main

# Option 3: Use SSH (if SSH key configured)
git remote add origin git@github.com:shaike1/ha-mcp-addon.git
git push -u origin main
```

## 🏪 Step 2: Create Add-on Repository for HA Community Store

### 2.1 Create Second Repository
Create another repository: `ha-mcp-addons-repository`

### 2.2 Repository Structure
```
ha-mcp-addons-repository/
├── README.md
├── repository.yaml
└── ha-mcp-bridge/
    ├── config.yaml
    ├── Dockerfile
    ├── DOCS.md
    ├── README.md
    ├── CHANGELOG.md
    ├── build.yaml
    └── rootfs/
        └── usr/
            └── bin/
                └── run.sh
```

### 2.3 Create Repository Files

I'll create a template directory structure you can copy: