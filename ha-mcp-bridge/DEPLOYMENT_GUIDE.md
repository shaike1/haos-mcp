# Deployment Guide: GitHub Backup & HA Community Store Submission

This guide covers backing up the add-on to GitHub and submitting it to the Home Assistant Community Store.

## 📤 Step 1: Backup to GitHub

### 1.1 Create GitHub Repository
1. Go to [GitHub](https://github.com) and sign in
2. Click **"New repository"** or go to https://github.com/new
3. Set repository details:
   - **Repository name**: `ha-mcp-addon`
   - **Description**: `Home Assistant Add-on for HA MCP Bridge - Claude.ai integration`
   - **Visibility**: Public (required for HA Community Store)
   - **Initialize**: Leave unchecked (we have existing code)

### 1.2 Push Local Repository to GitHub
```bash
# Navigate to the add-on directory
cd /root/ha-mcp/ha-mcp-addon

# Add GitHub remote (replace 'shaike1' with your username)
git remote add origin https://github.com/shaike1/ha-mcp-addon.git

# Push to GitHub
git push -u origin main
```

**If authentication fails**, use a Personal Access Token:
```bash
# Generate token at: https://github.com/settings/tokens
# Use token as password when prompted, or configure:
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/shaike1/ha-mcp-addon.git
git push -u origin main
```

### 1.3 Verify GitHub Upload
- Visit your repository: `https://github.com/shaike1/ha-mcp-addon`
- Confirm all files are present
- Check GitHub Actions are working (if applicable)

## 🏪 Step 2: Home Assistant Community Store Submission

### Option A: Submit to Official HA Community Add-ons

#### 2.1 Prepare for Official Submission
The official HA Community Add-ons repository has strict requirements:

**Requirements Checklist:**
- [ ] Add-on follows [HA Add-on Guidelines](https://developers.home-assistant.io/docs/add-ons/guidelines)
- [ ] Code review and testing completed
- [ ] Documentation is comprehensive
- [ ] Security review passed
- [ ] Multi-architecture builds working
- [ ] No external dependencies conflicts

#### 2.2 Submit to HA Community Add-ons
1. **Fork the repository**: https://github.com/home-assistant/addons
2. **Create new branch**: `feature/ha-mcp-bridge`
3. **Add your add-on** to the appropriate category
4. **Submit Pull Request** with detailed description
5. **Respond to review feedback** from HA team

**Note**: Official submission process can take weeks/months and has high standards.

### Option B: Create Custom Add-on Repository (Recommended)

#### 2.1 Create Add-on Repository
1. **Create new GitHub repository**: `ha-mcp-addons-repository`
2. **Repository structure**:
   ```
   ha-mcp-addons-repository/
   ├── README.md
   ├── repository.yaml
   └── ha-mcp-bridge/
       ├── config.yaml
       ├── Dockerfile
       ├── DOCS.md
       └── ... (all add-on files)
   ```

#### 2.2 Repository Configuration Files

**repository.yaml**:
```yaml
name: "HA MCP Add-ons"
url: "https://github.com/shaike1/ha-mcp-addons-repository"
maintainer: "Shaike"
```

**README.md**:
```markdown
# HA MCP Add-ons Repository

## Installation

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Click **⋮** menu → **Repositories**
3. Add repository URL: `https://github.com/shaike1/ha-mcp-addons-repository`
4. Find "HA MCP Bridge" and install

## Add-ons

### HA MCP Bridge
Model Context Protocol server for Claude.ai integration with Home Assistant.

- **Version**: 1.0.0
- **Supports**: aarch64, amd64, armhf, armv7, i386
- **Features**: OAuth 2.1, Nabu Casa integration, full device control
```

#### 2.3 Set Up Container Registry

**GitHub Container Registry** (Recommended):
1. **Enable GitHub Packages** in repository settings
2. **Create GitHub Action** for automated builds:

```yaml
# .github/workflows/publish.yml
name: Publish Add-on

on:
  release:
    types: [published]
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and publish
        uses: home-assistant/builder@master
        with:
          args: |
            --target ha-mcp-bridge \
            --all \
            --docker-hub ghcr.io/${{ github.repository_owner }}
```

## 🔧 Step 3: Configure Container Images

### 3.1 Update config.yaml
```yaml
# Update image reference to point to your registry
image: "ghcr.io/shaike1/ha-mcp-bridge/{arch}"

# Or for Docker Hub:
# image: "shaike1/ha-mcp-bridge-{arch}"
```

### 3.2 Build Multi-Architecture Images
```bash
# Local testing build
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag ghcr.io/shaike1/ha-mcp-bridge:latest \
  --push .
```

## 📋 Step 4: Testing and Validation

### 4.1 Test Local Installation
1. **Add your repository** to HA add-on store
2. **Install the add-on** and verify functionality
3. **Test all configuration options**
4. **Verify external access** methods work

### 4.2 Community Testing
1. **Share repository URL** with beta testers
2. **Collect feedback** and bug reports
3. **Update documentation** based on user experience
4. **Release stable version**

## 🎯 Step 5: Distribution Methods

### Method 1: Custom Repository (Easiest)
**Pros**: 
- Full control over releases
- Quick deployment
- No review process
- Can iterate rapidly

**Cons**:
- Users must manually add repository
- Less visibility
- No official HA endorsement

### Method 2: Home Assistant Community Add-ons (Official)
**Pros**:
- Official endorsement
- Built-in to HA
- High visibility
- Trusted by users

**Cons**:
- Strict review process
- Long approval time
- Limited control
- High maintenance standards

### Method 3: Third-Party Collections
**Examples**:
- Community Hass.io Add-ons
- EDGE Add-ons
- Custom collections

**Process**: Contact repository maintainers to include your add-on

## 📝 Step 6: Documentation and Support

### 6.1 Create Support Resources
- **GitHub Issues** for bug reports
- **GitHub Discussions** for Q&A
- **Documentation website** (GitHub Pages)
- **Community forum** posts

### 6.2 Maintenance Plan
- **Regular updates** for HA compatibility
- **Security patches** and dependency updates
- **Feature requests** evaluation
- **Breaking changes** communication

## 🔗 Useful Links

### Home Assistant Resources
- [Add-on Development](https://developers.home-assistant.io/docs/add-ons/)
- [Add-on Guidelines](https://developers.home-assistant.io/docs/add-ons/guidelines)
- [Community Add-ons](https://github.com/home-assistant/addons)
- [Builder Action](https://github.com/home-assistant/builder)

### Container Registries
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Hub](https://hub.docker.com/)
- [Quay.io](https://quay.io/)

### Example Repositories
- [Community Hass.io Add-ons](https://github.com/hassio-addons/repository)
- [EDGE Add-ons](https://github.com/hassio-addons/repository-edge)

---

## 🚀 Recommended Deployment Path

For the HA MCP Bridge add-on, I recommend:

1. **Start with Custom Repository** for rapid iteration and testing
2. **Build community** around the add-on
3. **Collect feedback** and improve stability
4. **Consider official submission** after proven success

This approach allows you to:
- Get users quickly
- Iterate based on feedback
- Build reputation
- Eventually move to official channels if desired