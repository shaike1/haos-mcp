#!/usr/bin/env node

import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { randomUUID, createHash } from 'crypto';
import WebSocket from 'ws';

// HA Configuration - ONLY set per session via login form (NO environment variables)
let HA_HOST = '';
let HA_API_TOKEN = '';

console.log('HA Configuration:');
console.log('HA_HOST:', 'Will be configured dynamically via login form');
console.log('HA_API_TOKEN:', 'Will be configured dynamically via login form');

// Persistent storage directory
const DATA_DIR = '/app/data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Session persistence functions
function saveSessionData() {
  const sessionData = {
    adminSessions: Array.from(adminSessions.entries()),
    accessTokens: Array.from(accessTokens.entries()),
    authenticatedSessions: Array.from(authenticatedSessions.entries()),
    savedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(DATA_DIR, 'sessions.json'), JSON.stringify(sessionData, null, 2));
}

function loadSessionData() {
  try {
    // ENABLE SESSION PERSISTENCE: Load cached session data
    console.log('LOADING session persistence - restoring saved sessions');
    
    const sessionFile = path.join(DATA_DIR, 'sessions.json');
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      console.log(`Loading persistent session data from ${data.savedAt}`);
      
      // Restore admin sessions (filter out expired ones)
      data.adminSessions.forEach(([token, sessionData]) => {
        if (new Date(sessionData.expiresAt) > new Date()) {
          adminSessions.set(token, {
            ...sessionData,
            createdAt: new Date(sessionData.createdAt),
            expiresAt: new Date(sessionData.expiresAt)
          });
        }
      });
      
      // Restore access tokens (filter out expired ones)
      data.accessTokens.forEach(([token, tokenData]) => {
        if (new Date(tokenData.expiresAt) > new Date()) {
          accessTokens.set(token, {
            ...tokenData,
            expiresAt: new Date(tokenData.expiresAt)
          });
        }
      });
      
      // Restore authenticated sessions
      data.authenticatedSessions.forEach(([clientId, authData]) => {
        if (new Date(authData.tokenData.expiresAt) > new Date()) {
          authenticatedSessions.set(clientId, {
            ...authData,
            authenticatedAt: new Date(authData.authenticatedAt),
            tokenData: {
              ...authData.tokenData,
              expiresAt: new Date(authData.tokenData.expiresAt)
            }
          });
        }
      });
      
      console.log(`Restored ${adminSessions.size} admin sessions, ${accessTokens.size} access tokens, ${authenticatedSessions.size} authenticated sessions`);
    }
  } catch (error) {
    console.error('Error loading session data:', error.message);
  }
}

// OAuth storage
const clients = new Map();
const authCodes = new Map();
const accessTokens = new Map();
const sessions = new Map();
const authenticatedSessions = new Map(); // Track OAuth-authenticated sessions

// Admin authentication - hardcoded for testing
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your_secure_admin_password_hash';
const adminSessions = new Map(); // Track authenticated admin sessions

// ENABLED: Load existing sessions on startup
loadSessionData();
console.log('SESSION PERSISTENCE ENABLED: Sessions will be saved and restored');

// ============================================================================
// PHASE 3 HYBRID BRIDGE: Integration Detection & Communication
// ============================================================================

class IntegrationBridge {
  constructor() {
    this.integrationAvailable = false;
    this.lastCheck = 0;
    this.checkInterval = 30000; // Check every 30 seconds
    this.integrationServices = [];
    this.integrationCapabilities = {};
  }

  async detectIntegration(sessionToken = null) {
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return this.integrationAvailable;
    }

    try {
      console.log('🔍 BRIDGE: Checking for MCP Bridge Integration...');
      
      // Check if integration is loaded via HA API
      const entities = await haRequest('/states', {}, sessionToken);
      const integrationEntities = entities.filter(e => 
        e.entity_id.startsWith('sensor.mcp_bridge')
      );
      
      if (integrationEntities.length > 0) {
        console.log('✅ BRIDGE: Integration detected! Found entities:', integrationEntities.map(e => e.entity_id));
        this.integrationAvailable = true;
        
        // Get integration capabilities
        const capabilitiesSensor = integrationEntities.find(e => 
          e.entity_id.includes('capabilities')
        );
        
        if (capabilitiesSensor && capabilitiesSensor.attributes) {
          this.integrationCapabilities = capabilitiesSensor.attributes;
          console.log('📋 BRIDGE: Integration capabilities:', this.integrationCapabilities);
        }
        
        // Check available services
        // Check available services via API first, fallback to HA services
        let services;
        try {
          const apiStatus = await haRequest('/api/mcp_bridge/status', {}, sessionToken);
          services = { mcp_bridge: apiStatus.services || {} };
          console.log('🛠️ BRIDGE: Using API for service detection');
        } catch (apiError) {
          console.log('⚠️ BRIDGE: API not available, using HA services');
          services = await haRequest('/services', {}, sessionToken);
        }        if (services.mcp_bridge) {
          this.integrationServices = Object.keys(services.mcp_bridge);
          console.log('🛠️ BRIDGE: Integration services:', this.integrationServices);
        }
      } else {
        console.log('❌ BRIDGE: Integration not detected - using add-on tools only');
        this.integrationAvailable = false;
        this.integrationCapabilities = {};
        this.integrationServices = [];
      }
      
      this.lastCheck = now;
      return this.integrationAvailable;
      
    } catch (error) {
      console.error('🚨 BRIDGE: Error detecting integration:', error.message);
      this.integrationAvailable = false;
      return false;
    }
  }

  async callIntegrationService(serviceName, serviceData, sessionToken = null) {
    if (!this.integrationAvailable) {
      throw new Error('Integration not available');
    }

    try {
      console.log(`🔗 BRIDGE: Calling integration service: ${serviceName}`);
      const result = await haRequest(`/api/mcp_bridge/${serviceName}`, {
        method: 'POST',
        body: JSON.stringify(serviceData)
      }, sessionToken);
      
      console.log(`✅ BRIDGE: Integration service completed: ${serviceName}`);
      return result;
    } catch (error) {
      console.error(`🚨 BRIDGE: Integration service failed: ${serviceName}`, error.message);
      throw error;
    }
  }

  isServiceAvailable(serviceName) {
    return this.integrationAvailable && this.integrationServices.includes(serviceName);
  }

  hasCapability(capability) {
    return this.integrationAvailable && this.integrationCapabilities[capability] === true;
  }
}

// Global integration bridge instance
const integrationBridge = new IntegrationBridge();

// ============================================================================
// PHASE 1 ENHANCEMENT: WebSocket Manager for Real-time HA Communication
// ============================================================================

class HAWebSocketManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.stateCache = new Map();
    this.eventSubscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async connect() {
    if (!HA_HOST || !HA_API_TOKEN) {
      console.log('WebSocket: Waiting for HA credentials...');
      return false;
    }

    try {
      const wsUrl = `${HA_HOST.replace('http', 'ws')}/api/websocket`;
      console.log(`WebSocket: Connecting to ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('WebSocket: Connected to Home Assistant');
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on('close', () => {
        console.log('WebSocket: Connection closed');
        this.connected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        this.connected = false;
      });

      return true;
    } catch (error) {
      console.error('WebSocket connection failed:', error.message);
      return false;
    }
  }

  handleMessage(message) {
    if (message.type === 'auth_required') {
      this.authenticate();
    } else if (message.type === 'auth_ok') {
      console.log('WebSocket: Authenticated successfully');
      this.subscribeToEvents();
      this.loadAllStates();
    } else if (message.type === 'result') {
      this.handleResult(message);
    } else if (message.type === 'event') {
      this.handleEvent(message.event);
    }
  }

  authenticate() {
    this.send({
      type: 'auth',
      access_token: HA_API_TOKEN
    });
  }

  async subscribeToEvents() {
    // Subscribe to state changes for real-time updates
    this.send({
      id: this.messageId++,
      type: 'subscribe_events',
      event_type: 'state_changed'
    });
    
    console.log('WebSocket: Subscribed to state_changed events');
  }

  async loadAllStates() {
    // Load all entity states into cache
    const id = this.messageId++;
    this.send({
      id,
      type: 'get_states'
    });
    
    this.pendingRequests.set(id, {
      type: 'get_states',
      resolve: (states) => {
        states.forEach(state => {
          this.stateCache.set(state.entity_id, state);
        });
        console.log(`WebSocket: Cached ${states.length} entity states`);
      }
    });
  }

  handleResult(message) {
    const request = this.pendingRequests.get(message.id);
    if (request) {
      if (message.success) {
        request.resolve(message.result);
      } else {
        request.reject && request.reject(new Error(message.error.message));
      }
      this.pendingRequests.delete(message.id);
    }
  }

  handleEvent(event) {
    if (event.event_type === 'state_changed') {
      const { entity_id, new_state } = event.data;
      if (new_state) {
        this.stateCache.set(entity_id, new_state);
        console.log(`WebSocket: State updated - ${entity_id}: ${new_state.state}`);
      }
    }
  }

  async callService(domain, service, serviceData = {}) {
    if (!this.connected) {
      throw new Error('WebSocket not connected to Home Assistant');
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      
      this.pendingRequests.set(id, {
        type: 'call_service',
        resolve,
        reject
      });

      this.send({
        id,
        type: 'call_service',
        domain,
        service,
        service_data: serviceData
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Service call timeout'));
        }
      }, 30000);
    });
  }

  getEntityState(entityId) {
    return this.stateCache.get(entityId);
  }

  getAllStates() {
    return Array.from(this.stateCache.values());
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

// Global WebSocket manager instance
const haWebSocket = new HAWebSocketManager();

console.log('Admin Authentication:');
console.log('Username:', ADMIN_USERNAME);
console.log('Password:', ADMIN_PASSWORD ? '***SET***' : 'NOT SET - USING DEFAULT');

// Generate admin session token with HA connection details
function createAdminSession(haHost, haApiToken) {
  const sessionToken = randomUUID();
  const sessionData = {
    authenticated: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    haHost: haHost,
    haApiToken: haApiToken
  };
  adminSessions.set(sessionToken, sessionData);
  saveSessionData(); // Persist immediately
  return sessionToken;
}

// Verify admin session
function verifyAdminSession(sessionToken) {
  const session = adminSessions.get(sessionToken);
  if (!session || session.expiresAt < new Date()) {
    if (session) adminSessions.delete(sessionToken);
    return false;
  }
  return true;
}

// Simple HA API client - uses session-specific credentials
async function haRequest(endpoint, options = {}, sessionToken = null) {
  let haHost = HA_HOST;
  let haApiToken = HA_API_TOKEN;
  
  // If session token provided, use session-specific HA credentials
  if (sessionToken) {
    const session = adminSessions.get(sessionToken);
    if (session && session.haHost && session.haApiToken) {
      haHost = session.haHost;
      haApiToken = session.haApiToken;
    }
  }
  
  if (!haHost || !haApiToken) {
    throw new Error('HA connection not configured. Please login with HA details.');
  }
  
  const apiUrl = `${haHost}/api${endpoint}`;
  
  const fetch = (await import('node-fetch')).default;
  
  // Add timeout to prevent hanging connections (increased for Claude.ai stability)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${haApiToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal,
      timeout: 30000,
      ...options
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HA API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('HA API request timed out (30s) - try requesting a specific entity or smaller dataset');
    }
    throw error;
  }
}

// Get available Home Assistant tools - HYBRID VERSION
async function getTools(sessionToken = null) {
  // Detect integration capabilities
  await integrationBridge.detectIntegration(sessionToken);
  
  console.log(`🔧 HYBRID TOOLS: Integration available: ${integrationBridge.integrationAvailable}`);
  if (integrationBridge.integrationAvailable) {
    console.log(`🔧 HYBRID TOOLS: Integration services: ${integrationBridge.integrationServices.join(', ')}`);
  }
  const addonTools = [
    {
      name: "get_entities",
      description: "Get all Home Assistant entities or filter by domain",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Filter by domain (light, switch, sensor, etc.)" }
        },
        required: []
      }
    },
    {
      name: "call_service",
      description: "Call a Home Assistant service to control devices",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Service domain" },
          service: { type: "string", description: "Service name" },
          entity_id: { type: "string", description: "Target entity ID" },
          data: { type: "object", description: "Additional service data" }
        },
        required: ["domain", "service"]
      }
    },
    {
      name: "get_automations",
      description: "Get all Home Assistant automations",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "get_lights",
      description: "Get all light entities",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "get_switches",
      description: "Get all switch entities",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "get_climate",
      description: "Get climate/HVAC entities (air conditioning, heating) with temperature info",
      inputSchema: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "Specific climate entity ID (optional)" }
        },
        required: []
      }
    },
    {
      name: "get_sensors",
      description: "Get sensor entities including water leak, presence, motion, temperature sensors",
      inputSchema: {
        type: "object",
        properties: {
          sensor_type: { type: "string", description: "Filter by sensor type: water_leak, presence, motion, temperature, all" }
        },
        required: []
      }
    },
    {
      name: "control_lights",
      description: "Control lights - turn on/off, set brightness, change color",
      inputSchema: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "Light entity ID" },
          action: { type: "string", description: "Action: turn_on, turn_off, toggle" },
          brightness: { type: "number", description: "Brightness 0-255 (for turn_on)" },
          color: { type: "string", description: "Color name or hex code (for turn_on)" }
        },
        required: ["entity_id", "action"]
      }
    },
    {
      name: "get_temperature_simple",
      description: "Get temperature sensors quickly (mock data for testing)",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "test_simple",
      description: "Simple test tool that returns instantly",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    }
  ];

  // Add integration-specific advanced tools if available
  const integrationTools = [];
  
  if (integrationBridge.hasCapability('dynamic_scene_creation')) {
    integrationTools.push({
      name: "create_dynamic_scene",
      description: "🚀 ADVANCED: Create dynamic scenes with complex configurations (Integration)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Scene name" },
          entities: {
            type: "array",
            description: "List of entities with their desired states",
            items: {
              type: "object",
              properties: {
                entity_id: { type: "string", description: "Entity ID" },
                state: { type: "string", description: "Desired state" },
                brightness: { type: "number", description: "Brightness (1-255)" },
                color_temp: { type: "number", description: "Color temperature (153-500)" },
                temperature: { type: "number", description: "Temperature (5-35)" }
              },
              required: ["entity_id"]
            }
          }
        },
        required: ["name", "entities"]
      }
    });
  }
  
  if (integrationBridge.hasCapability('automation_management')) {
    integrationTools.push({
      name: "modify_automation",
      description: "🚀 ADVANCED: Create or modify automations with templates (Integration)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Automation name" },
          template: { type: "string", description: "Template: motion_light, sunset_scene, presence_climate, custom" },
          trigger_entity: { type: "string", description: "Trigger entity ID" },
          target_entity: { type: "string", description: "Target entity ID" },
          config: { type: "object", description: "Additional configuration" }
        },
        required: ["name"]
      }
    });
  }
  
  if (integrationBridge.hasCapability('bulk_device_control')) {
    integrationTools.push({
      name: "bulk_device_control",
      description: "🚀 ADVANCED: Control multiple devices with transaction support (Integration)",
      inputSchema: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            description: "List of operations to perform",
            items: {
              type: "object",
              properties: {
                entity_id: { type: "string", description: "Entity ID" },
                action: { type: "string", description: "Action to perform" },
                params: { type: "object", description: "Action parameters" }
              },
              required: ["entity_id", "action"]
            }
          },
          rollback_on_error: { type: "boolean", description: "Rollback if any operation fails" }
        },
        required: ["operations"]
      }
    });
  }
  
  if (integrationBridge.hasCapability('dashboard_generation')) {
    integrationTools.push({
      name: "generate_dashboard",
      description: "🚀 ADVANCED: Generate Lovelace dashboard configurations (Integration)",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Dashboard title" },
          area_id: { type: "string", description: "Area/room ID" },
          type: { type: "string", description: "Dashboard type: room, security, energy" }
        },
        required: ["title"]
      }
    });
  }

  const allTools = [...addonTools, ...integrationTools];
  
  console.log(`🔧 HYBRID TOOLS: Returning ${allTools.length} tools (${addonTools.length} add-on + ${integrationTools.length} integration)`);
  if (integrationTools.length > 0) {
    console.log(`🚀 Advanced tools available: ${integrationTools.map(t => t.name).join(', ')}`);
  }
  
  return allTools;
}

// Call a tool - HYBRID VERSION with integration routing
async function callTool(name, args, sessionToken = null) {
  // Check if this is an integration tool
  const integrationTools = ['create_dynamic_scene', 'modify_automation', 'bulk_device_control', 'generate_dashboard'];
  
  if (integrationTools.includes(name)) {
    // Ensure integration is available
    await integrationBridge.detectIntegration(sessionToken);
    
    if (integrationBridge.isServiceAvailable(name)) {
      console.log(`🚀 HYBRID: Routing ${name} to integration`);
      try {
        const result = await integrationBridge.callIntegrationService(name, args, sessionToken);
        return {
          content: [{
            type: "text",
            text: `✅ Advanced operation completed via integration: ${JSON.stringify(result, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`🚨 HYBRID: Integration tool ${name} failed, falling back to add-on:`, error.message);
        // Continue to add-on fallback below
      }
    } else {
      console.log(`⚠️ HYBRID: Integration tool ${name} not available, using add-on fallback`);
      // Provide limited add-on alternative for advanced tools
      if (name === 'create_dynamic_scene') {
        return {
          content: [{
            type: "text",
            text: `⚠️ Dynamic scene creation requires the MCP Bridge Integration. Using basic scene approach instead. You can manually create a scene via HA UI with the entities: ${JSON.stringify(args.entities, null, 2)}`
          }]
        };
      }
      // Continue to normal add-on tool processing
    }
  }
  console.log(`🔧 TOOL CALL: ${name}`);
  console.log(`🔧 Tool arguments:`, JSON.stringify(args, null, 2));
  console.log(`🔧 Session token available:`, sessionToken ? 'YES' : 'NO');
  console.log(`Tool args:`, JSON.stringify(args));
  console.log(`Session token:`, sessionToken ? 'PROVIDED' : 'NULL');
  
  try {
    console.log(`Entering switch statement for tool: ${name}`);
    switch (name) {
      case "get_entities":
        console.log('DEBUG: get_entities called with sessionToken:', sessionToken ? 'PROVIDED' : 'NULL');
        const entities = await haRequest('/states', {}, sessionToken);
        
        let filteredEntities = entities;
        if (args?.domain) {
          filteredEntities = entities.filter(e => e.entity_id.startsWith(args.domain + '.'));
          
          // Create concise human-readable list
          const summary = filteredEntities.slice(0, 10).map(e => 
            `• ${e.attributes.friendly_name || e.entity_id}: ${e.state}`
          ).join('\n');
          
          const moreText = filteredEntities.length > 10 ? `\n\n... and ${filteredEntities.length - 10} more entities` : '';
          
          return {
            content: [{
              type: "text",
              text: `Found ${filteredEntities.length} entities in domain '${args.domain}':\n\n${summary}${moreText}`
            }]
          };
        } else {
          // When getting ALL entities, always simplify to prevent timeouts
          const simplified = entities.map(e => ({
            entity_id: e.entity_id,
            state: e.state,
            friendly_name: e.attributes.friendly_name || e.entity_id,
            domain: e.entity_id.split('.')[0]
          }));
          
          // Group by domain for easier reading
          const byDomain = simplified.reduce((acc, entity) => {
            if (!acc[entity.domain]) acc[entity.domain] = [];
            acc[entity.domain].push({
              entity_id: entity.entity_id,
              state: entity.state,
              friendly_name: entity.friendly_name
            });
            return acc;
          }, {});
          
          return {
            content: [{
              type: "text",
              text: `Found ${entities.length} total entities grouped by domain (use domain filter for detailed view):\n\n${JSON.stringify(byDomain, null, 2)}`
            }]
          };
        }
        
        return {
          content: [{
            type: "text", 
            text: JSON.stringify(filteredEntities, null, 2)
          }]
        };
        
      case "call_service":
        const serviceData = { ...args.data };
        if (args.entity_id) serviceData.entity_id = args.entity_id;
        
        const serviceResult = await haRequest(`/services/${args.domain}/${args.service}`, {
          method: 'POST',
          body: JSON.stringify(serviceData)
        }, sessionToken);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(serviceResult, null, 2)
          }]
        };
        
      case "get_automations":
        const allEntities = await haRequest('/states', {}, sessionToken);
        const automations = allEntities.filter(e => e.entity_id.startsWith('automation.'));
        return {
          content: [{
            type: "text",
            text: JSON.stringify(automations, null, 2)
          }]
        };
        
      case "get_lights":
        const allLightEntities = await haRequest('/states', {}, sessionToken);
        const lights = allLightEntities.filter(e => e.entity_id.startsWith('light.'));
        return {
          content: [{
            type: "text",
            text: JSON.stringify(lights, null, 2)
          }]
        };
        
      case "get_switches":
        const allSwitchEntities = await haRequest('/states', {}, sessionToken);
        const switches = allSwitchEntities.filter(e => e.entity_id.startsWith('switch.'));
        return {
          content: [{
            type: "text",
            text: JSON.stringify(switches, null, 2)
          }]
        };
        
      case "get_climate":
        if (args.entity_id) {
          // Get specific climate entity
          const climateEntity = await haRequest(`/states/${args.entity_id}`, {}, sessionToken);
          return {
            content: [{
              type: "text", 
              text: JSON.stringify(climateEntity, null, 2)
            }]
          };
        } else {
          // Get all climate entities with timeout protection
          try {
            console.log('🌡️ Starting HA API call for climate entities...');
            const startTime = Date.now();
            const allEntities = await haRequest('/states', {}, sessionToken);
            const elapsed = Date.now() - startTime;
            console.log(`🌡️ HA API call completed in ${elapsed}ms, got ${allEntities.length} entities`);
            const climateEntities = allEntities.filter(e => e.entity_id.startsWith('climate.'));
            console.log(`🌡️ Found ${climateEntities.length} climate entities`);
            
            // Create concise human-readable summary 
            const summary = climateEntities.map(entity => {
              const name = entity.attributes.friendly_name || entity.entity_id;
              const current = entity.attributes.current_temperature;
              const target = entity.attributes.temperature;
              const mode = entity.attributes.hvac_mode || entity.state;
              return `• ${name}: ${current}°C → ${target}°C (${mode})`;
            }).join('\n');
            
            return {
              content: [{
                type: "text",
                text: `Found ${climateEntities.length} climate entities:\n\n${summary}`
              }]
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Climate data temporarily unavailable: ${error.message}`
              }]
            };
          }
        }
        
      case "get_sensors":
        try {
          console.log('DEBUG: get_sensors called');
          
          const allEntities = await haRequest('/states', {}, sessionToken);
          let sensorEntities = allEntities.filter(e => 
            e.entity_id.startsWith('binary_sensor.') || 
            e.entity_id.startsWith('sensor.')
          );
          
          // Filter by sensor type if specified
          if (args?.sensor_type && args.sensor_type !== 'all') {
            const filterMap = {
              'water_leak': (e) => e.entity_id.includes('leak') || e.entity_id.includes('water') || e.attributes.device_class === 'moisture',
              'presence': (e) => e.entity_id.includes('presence') || e.entity_id.includes('occupancy') || e.attributes.device_class === 'occupancy',
              'motion': (e) => e.entity_id.includes('motion') || e.attributes.device_class === 'motion',
              'temperature': (e) => e.attributes.device_class === 'temperature' || e.attributes.unit_of_measurement === '°C'
            };
            
            if (filterMap[args.sensor_type]) {
              sensorEntities = sensorEntities.filter(filterMap[args.sensor_type]);
            }
          }
          
          if (sensorEntities.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No ${args?.sensor_type || 'sensor'} entities found`
              }]
            };
          }
          
          // Limit to first 5 results for faster response
          const summary = sensorEntities.slice(0, 5).map(entity => {
            const name = entity.attributes.friendly_name || entity.entity_id;
            const state = entity.state;
            const unit = entity.attributes.unit_of_measurement || '';
            const deviceClass = entity.attributes.device_class ? `[${entity.attributes.device_class}]` : '';
            return `• ${name}: ${state}${unit} ${deviceClass}`.trim();
          }).join('\n');
          
          return {
            content: [{
              type: "text",
              text: `Found ${sensorEntities.length} sensor entities:\n\n${summary}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Sensor data temporarily unavailable: ${error.message}`
            }]
          };
        }
        
      case "control_lights":
        try {
          console.log('DEBUG: control_lights called');
          
          if (!args?.entity_id || !args?.action) {
            return {
              content: [{
                type: "text",
                text: "Missing required parameters: entity_id and action"
              }]
            };
          }
          
          let serviceData = { entity_id: args.entity_id };
          
          // Add brightness if specified for turn_on
          if (args.action === 'turn_on' && args.brightness !== undefined) {
            serviceData.brightness = Math.max(0, Math.min(255, args.brightness));
          }
          
          // Add color if specified for turn_on
          if (args.action === 'turn_on' && args.color) {
            if (args.color.startsWith('#')) {
              serviceData.hex_color = args.color;
            } else {
              serviceData.color_name = args.color;
            }
          }
          
          const result = await haRequest('/services/light/' + args.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serviceData)
          }, sessionToken);
          
          const actionText = {
            'turn_on': 'turned on',
            'turn_off': 'turned off', 
            'toggle': 'toggled'
          }[args.action] || args.action;
          
          const extraInfo = [];
          if (args.brightness !== undefined) extraInfo.push(`brightness: ${args.brightness}`);
          if (args.color) extraInfo.push(`color: ${args.color}`);
          const extraText = extraInfo.length > 0 ? ` (${extraInfo.join(', ')})` : '';
          
          return {
            content: [{
              type: "text",
              text: `✅ Light ${args.entity_id} ${actionText}${extraText}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Light control failed: ${error.message}`
            }]
          };
        }
      
      case "get_temperature_simple":
        // Fast mock temperature data to avoid timeouts
        return {
          content: [{
            type: "text",
            text: "🌡️ Temperature sensors:\n• Living Room: 22.5°C [temperature]\n• Bedroom: 20.1°C [temperature]\n• Kitchen: 24.3°C [temperature]\n• Outside: 18.7°C [temperature]"
          }]
        };
        
      case "test_simple":
        return {
          content: [{
            type: "text",
            text: "✅ Test tool working! Server is responding correctly. The MCP connection is stable."
          }]
        };
        
      case "get_climate_simple":
        // Test climate tool without HA API call
        return {
          content: [{
            type: "text",
            text: "🌡️ Mock climate data:\n• Living Room AC: 22°C → 24°C (cooling)\n• Bedroom AC: 20°C → 21°C (heating)\n• Kitchen AC: 23°C → 23°C (auto)"
          }]
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`ERROR in tool ${name}:`, error.message);
    console.error('Error stack:', error.stack);
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
}

// Verify access token
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const tokenData = accessTokens.get(token);
  
  if (!tokenData || tokenData.expiresAt < new Date()) {
    return null;
  }
  
  return tokenData;
}

// Verify session-based authentication for Claude.ai
function verifySessionAuth(sessionId) {
  if (!sessionId) {
    return null;
  }
  
  // Check if this specific session is marked as authenticated
  const sessionData = sessions.get(sessionId);
  if (sessionData && sessionData.authenticated) {
    // Find any valid token data from authenticated sessions
    for (const [clientId, authData] of authenticatedSessions.entries()) {
      if (authData.tokenData.expiresAt > new Date()) {
        return authData.tokenData;
      }
    }
  }
  
  return null;
}

// OAuth and MCP server
const httpServer = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  
  // Handle ingress paths by stripping the ingress prefix
  let actualPath = parsedUrl.pathname;
  const ingressPrefix = '/api/hassio_ingress/ha-mcp-bridge-v2';
  if (actualPath.startsWith(ingressPrefix)) {
    actualPath = actualPath.substring(ingressPrefix.length) || '/';
    // Update parsedUrl to use the actual path
    parsedUrl.pathname = actualPath;
    console.log(`🔀 Ingress request: ${req.url} -> ${actualPath}`);
  }
  
  // Root path handler for ingress health checks  
  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const serverUrl = process.env.SERVER_URL || 'https://ha.right-api.com';
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Bridge - Ready for Claude.ai</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 10px; margin-bottom: 20px; }
        .url-box { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #2196F3; }
        .url { font-family: monospace; font-size: 14px; word-break: break-all; font-weight: bold; color: #1976D2; }
        .status { color: #4CAF50; font-weight: bold; }
        .instructions { background: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #FF9800; }
        .endpoint { background: #f5f5f5; padding: 8px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="header">🏠 HA MCP Bridge v2.1.0</h1>
        
        <p class="status">✅ Status: Ready for Claude.ai connection</p>
        
        <h2>🎯 Claude.ai MCP URL</h2>
        <div class="url-box">
            <strong>Use this URL in Claude.ai:</strong><br>
            <div class="url">${serverUrl}</div>
        </div>
        
        <div class="instructions">
            <h3>📋 Setup Instructions:</h3>
            <ol>
                <li>Copy the URL above</li>
                <li>Download: <a href="https://raw.githubusercontent.com/shaike1/haos-mcp/main/ha-mcp-bridge.dxt" target="_blank">ha-mcp-bridge.dxt</a></li>
                <li>Replace "REPLACE_WITH_YOUR_INGRESS_URL" with the URL above</li>
                <li>Import the .dxt file into Claude.ai → Settings → MCP</li>
                <li>Login with username: <strong>admin</strong> and your configured password</li>
            </ol>
        </div>
        
        <h3>🔗 Available Endpoints:</h3>
        <div class="endpoint">/.well-known/oauth-authorization-server</div>
        <div class="endpoint">/oauth/authorize</div>
        <div class="endpoint">/oauth/callback</div>
        <div class="endpoint">/oauth/token</div>
        
        <h3>🏠 Home Assistant Tools Available:</h3>
        <ul>
            <li>🏠 Light control (get_lights, control_light)</li>
            <li>🌡️ Sensor monitoring (get_sensors)</li>
            <li>🔌 Switch control (get_switches, control_switch)</li>
            <li>🌡️ Climate control (get_climate, set_climate)</li>
            <li>⚡ Automation triggers (run_automation)</li>
            <li>📍 Areas and devices (get_areas, get_devices)</li>
        </ul>
    </div>
</body>
</html>
    `);
    return;
  }

  // OAuth discovery endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/.well-known/oauth-authorization-server') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issuer: process.env.SERVER_URL || 'https://ha-mcp.right-api.com',
      authorization_endpoint: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/oauth/authorize`,
      token_endpoint: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/oauth/token`,
      registration_endpoint: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/oauth/register`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256']
    }));
    return;
  }
  
  // Dynamic client registration
  if (req.method === 'POST' && parsedUrl.pathname === '/oauth/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const clientRequest = JSON.parse(body);
        const clientId = randomUUID();
        const clientSecret = randomUUID();
        
        clients.set(clientId, {
          id: clientId,
          secret: clientSecret,
          redirectUris: clientRequest.redirect_uris || [],
          createdAt: new Date()
        });
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          client_secret_expires_at: 0
        }));
      } catch (error) {
        res.writeHead(400);
        res.end('Invalid registration request');
      }
    });
    return;
  }
  
  // Token registration endpoint (for pre-registering API tokens)
  if (req.method === 'POST' && parsedUrl.pathname === '/tokens/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const tokenRequest = JSON.parse(body);
        const { description, scope } = tokenRequest;
        
        // Generate a new API token
        const apiToken = randomUUID();
        const tokenData = {
          clientId: 'api-client',
          scope: scope || 'mcp',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          resource: process.env.SERVER_URL || 'https://ha-mcp.right-api.com',
          description: description || 'API Token',
          createdAt: new Date()
        };
        
        accessTokens.set(apiToken, tokenData);
        console.log(`Registered new API token: ${description || 'API Token'}`);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: apiToken,
          token_type: 'Bearer',
          expires_in: 31536000, // 1 year in seconds
          scope: tokenData.scope,
          description: tokenData.description,
          created_at: tokenData.createdAt.toISOString()
        }));
      } catch (error) {
        console.error('Token registration error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid token registration request'
        }));
      }
    });
    return;
  }
  
  // Token management endpoint (list/revoke tokens)
  if (req.method === 'GET' && parsedUrl.pathname === '/tokens') {
    const tokens = [];
    for (const [token, data] of accessTokens.entries()) {
      tokens.push({
        token: token.substring(0, 8) + '...',
        description: data.description,
        scope: data.scope,
        created_at: data.createdAt?.toISOString(),
        expires_at: data.expiresAt.toISOString(),
        client_id: data.clientId
      });
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tokens }));
    return;
  }
  
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/tokens/')) {
    const tokenToRevoke = parsedUrl.pathname.split('/tokens/')[1];
    if (accessTokens.has(tokenToRevoke)) {
      accessTokens.delete(tokenToRevoke);
      console.log(`Revoked token: ${tokenToRevoke}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Token revoked successfully' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token not found' }));
    }
    return;
  }
  
  // Authorization endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/oauth/authorize') {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = parsedUrl.query;
    
    // Accept Claude.ai client or any registered client
    let client = clients.get(client_id);
    if (!client) {
      // Auto-register Claude.ai client if not exists
      console.log(`Auto-registering client: ${client_id}`);
      client = {
        id: client_id,
        secret: 'claude-ai-client-secret',
        redirectUris: [redirect_uri],
        createdAt: new Date()
      };
      clients.set(client_id, client);
    }
    
    // Check if user is already authenticated
    const sessionCookie = req.headers.cookie?.split(';')
      .find(c => c.trim().startsWith('admin_session='))
      ?.split('=')[1];
    
    if (sessionCookie && verifyAdminSession(sessionCookie)) {
      // User is authenticated, show consent page
      const consentPage = `
<!DOCTYPE html>
<html>
<head>
    <title>Authorize HA MCP Access</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .consent-box { border: 2px solid #007cba; border-radius: 10px; padding: 30px; background: #f9f9f9; }
        .app-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .permissions { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .actions { text-align: center; margin: 30px 0; }
        .btn { padding: 12px 30px; margin: 0 10px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn-allow { background: #28a745; color: white; }
        .btn-deny { background: #dc3545; color: white; }
        .btn:hover { opacity: 0.8; }
        .authenticated { background: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="consent-box">
        <div class="authenticated">Authenticated as: ${ADMIN_USERNAME}</div>
        
        <h2>Authorization Request</h2>
        
        <div class="app-info">
            <h3>Application Details:</h3>
            <p><strong>App:</strong> Claude.ai</p>
            <p><strong>Client ID:</strong> ${client_id}</p>
            <p><strong>Redirect URI:</strong> ${redirect_uri}</p>
        </div>
        
        <div class="permissions">
            <h3>Requested Permissions:</h3>
            <ul>
                <li><strong>Home Assistant Device Control</strong> - List, read, and control devices</li>
                <li><strong>Entity Access</strong> - View and manage entities and automations</li>
                <li><strong>Service Calls</strong> - Execute Home Assistant services</li>
            </ul>
        </div>
        
        <p><strong>Warning:</strong> This will give Claude.ai access to control your Home Assistant devices.</p>
        
        <div class="actions">
            <button class="btn btn-allow" onclick="authorize()">Allow Access</button>
            <button class="btn btn-deny" onclick="deny()">Deny Access</button>
        </div>
    </div>
    
    <script>
        function authorize() {
            window.location.href = '/oauth/approve?${new URLSearchParams({
              client_id,
              redirect_uri,
              state,
              code_challenge,
              code_challenge_method,
              scope: scope || 'mcp'
            }).toString()}';
        }
        
        function deny() {
            window.location.href = '${redirect_uri}?error=access_denied&state=${state}';
        }
    </script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(consentPage);
      return;
    }
    
    // User not authenticated, show login form
    const loginPage = `
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Server - Login Required</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-box { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .title { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #005a87; }
        .error { color: #dc3545; text-align: center; margin: 15px 0; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 class="title">HA MCP Server</h2>
        
        <div class="info">
            <strong>Claude.ai</strong> is requesting access to your Home Assistant devices.
            Please authenticate and configure your HA connection.
        </div>
        
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope || 'mcp'}">
            
            <div class="form-group">
                <label for="username">Admin Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Admin Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <hr style="margin: 20px 0; border: 1px solid #ddd;">
            
            <div class="form-group">
                <label for="ha_host">Home Assistant Host URL:</label>
                <input type="url" id="ha_host" name="ha_host" placeholder="https://your-ha-instance.com" required>
            </div>
            
            <div class="form-group">
                <label for="ha_api_token">Home Assistant API Token:</label>
                <input type="password" id="ha_api_token" name="ha_api_token" placeholder="Your HA Long-Lived Access Token" required>
            </div>
            
            <button type="submit" class="btn">Login &amp; Authorize</button>
        </form>
    </div>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loginPage);
    return;
  }
  
  // Login endpoint - Process username/password authentication
  if (req.method === 'POST' && parsedUrl.pathname === '/oauth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const params = new URLSearchParams(body);
        const username = params.get('username');
        const password = params.get('password');
        const ha_host = params.get('ha_host');
        const ha_api_token = params.get('ha_api_token');
        const client_id = params.get('client_id');
        const redirect_uri = params.get('redirect_uri');
        const state = params.get('state');
        const code_challenge = params.get('code_challenge');
        const code_challenge_method = params.get('code_challenge_method');
        const scope = params.get('scope');
        
        console.log(`Login attempt for username: ${username}`);
        console.log(`HA Host: ${ha_host}`);
        
        // Validate credentials
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
          console.log('Admin authentication successful');
          
          // Test HA connection before proceeding
          try {
            // Temporarily set connection for testing
            const tempToken = randomUUID();
            adminSessions.set(tempToken, {
              authenticated: true,
              haHost: ha_host,
              haApiToken: ha_api_token,
              expiresAt: new Date(Date.now() + 60000) // 1 minute temp session
            });
            
            // Test the connection
            await haRequest('/states?limit=1', {}, tempToken);
            adminSessions.delete(tempToken); // Clean up temp session
            
            console.log('HA connection test successful');
            
            // Create admin session with HA connection details
            const sessionToken = createAdminSession(ha_host, ha_api_token);
          
          // Set secure session cookie
          const cookieOptions = [
            `admin_session=${sessionToken}`,
            'HttpOnly',
            'Secure',
            'SameSite=Lax',
            'Path=/',
            `Max-Age=${30 * 60}` // 30 minutes
          ].join('; ');
          
          // Redirect back to authorization with session cookie
          const redirectUrl = `/oauth/authorize?${new URLSearchParams({
            client_id,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method,
            scope
          }).toString()}`;
          
          res.writeHead(302, { 
            'Location': redirectUrl,
            'Set-Cookie': cookieOptions
          });
          res.end();
          return;
          } catch (haError) {
            console.log('HA connection failed:', haError.message);
            
            // Show login form with HA connection error
            const haErrorPage = `
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Server - Connection Failed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-box { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .title { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #005a87; }
        .error { color: #dc3545; text-align: center; margin: 15px 0; background: #f8d7da; padding: 10px; border-radius: 5px; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 class="title">HA MCP Server</h2>
        
        <div class="error">HA Connection Failed: ${haError.message}</div>
        
        <div class="info">
            Please check your Home Assistant host URL and API token, then try again.
        </div>
        
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope}">
            
            <div class="form-group">
                <label for="username">Admin Username:</label>
                <input type="text" id="username" name="username" value="${username}" required>
            </div>
            
            <div class="form-group">
                <label for="password">Admin Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <hr style="margin: 20px 0; border: 1px solid #ddd;">
            
            <div class="form-group">
                <label for="ha_host">Home Assistant Host URL:</label>
                <input type="url" id="ha_host" name="ha_host" value="${ha_host}" placeholder="https://your-ha-instance.com" required>
            </div>
            
            <div class="form-group">
                <label for="ha_api_token">Home Assistant API Token:</label>
                <input type="password" id="ha_api_token" name="ha_api_token" placeholder="Your HA Long-Lived Access Token" required>
            </div>
            
            <button type="submit" class="btn">Login &amp; Authorize</button>
        </form>
    </div>
</body>
</html>`;
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(haErrorPage);
            return;
          }
        } else {
          console.log('Authentication failed - invalid credentials');
          
          // Show login form with error
          const errorPage = `
<!DOCTYPE html>
<html>
<head>
    <title>HA MCP Server - Login Failed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-box { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .title { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #005a87; }
        .error { color: #dc3545; text-align: center; margin: 15px 0; background: #f8d7da; padding: 10px; border-radius: 5px; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 class="title">HA MCP Server</h2>
        
        <div class="error">Invalid username or password. Please try again.</div>
        
        <div class="info">
            <strong>Claude.ai</strong> is requesting access to your Home Assistant devices.
            Please authenticate to continue.
        </div>
        
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope}">
            
            <div class="form-group">
                <label for="username">Admin Username:</label>
                <input type="text" id="username" name="username" value="${username || ''}" required>
            </div>
            
            <div class="form-group">
                <label for="password">Admin Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <hr style="margin: 20px 0; border: 1px solid #ddd;">
            
            <div class="form-group">
                <label for="ha_host">Home Assistant Host URL:</label>
                <input type="url" id="ha_host" name="ha_host" value="${ha_host || ''}" placeholder="https://your-ha-instance.com" required>
            </div>
            
            <div class="form-group">
                <label for="ha_api_token">Home Assistant API Token:</label>
                <input type="password" id="ha_api_token" name="ha_api_token" placeholder="Your HA Long-Lived Access Token" required>
            </div>
            
            <button type="submit" class="btn">Login &amp; Authorize</button>
        </form>
    </div>
</body>
</html>`;
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(errorPage);
          return;
        }
      } catch (error) {
        console.error('Login processing error:', error);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>400 Bad Request</h1><p>Invalid login request</p>');
      }
    });
    return;
  }
  
  // OAuth approval endpoint (after user clicks "Allow")
  if (req.method === 'GET' && parsedUrl.pathname === '/oauth/approve') {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = parsedUrl.query;
    
    // Get admin session token from cookie
    const sessionCookie = req.headers.cookie?.split(';')
      .find(c => c.trim().startsWith('admin_session='))
      ?.split('=')[1];
    
    // Now generate authorization code after user consent
    const code = randomUUID();
    authCodes.set(code, {
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      scope: scope,
      adminSessionToken: sessionCookie // Link to admin session
    });
    
    console.log(`Created auth code with admin session token: ${sessionCookie ? sessionCookie.substring(0, 8) + '...' : 'null'}`);
    
    console.log(`User approved authorization for client: ${client_id}`);
    
    // Redirect with authorization code
    const redirectUrl = `${redirect_uri}?code=${code}&state=${state}`;
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
    return;
  }
  
  // Token endpoint
  if (req.method === 'POST' && parsedUrl.pathname === '/oauth/token') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        console.log('Token exchange request body:', body);
        const params = new URLSearchParams(body);
        const code = params.get('code');
        const clientId = params.get('client_id');
        const codeVerifier = params.get('code_verifier');
        
        console.log('Token exchange params:', { code, clientId, codeVerifier });
        console.log('Available auth codes:', Array.from(authCodes.keys()));
        
        const authCode = authCodes.get(code);
        console.log('Found auth code:', authCode);
        
        if (!authCode) {
          console.log('ERROR: Authorization code not found');
          res.writeHead(400);
          res.end('Authorization code not found');
          return;
        }
        
        if (authCode.expiresAt < new Date()) {
          console.log('ERROR: Authorization code expired');
          res.writeHead(400);
          res.end('Authorization code expired');
          return;
        }
        
        if (authCode.clientId !== clientId) {
          console.log('ERROR: Client ID mismatch');
          res.writeHead(400);
          res.end('Client ID mismatch');
          return;
        }
        
        // Verify PKCE if provided
        if (authCode.codeChallenge && authCode.codeChallengeMethod === 'S256') {
          const hash = createHash('sha256').update(codeVerifier).digest('base64url');
          console.log('PKCE verification:', { 
            provided: authCode.codeChallenge, 
            calculated: hash, 
            matches: hash === authCode.codeChallenge 
          });
          if (hash !== authCode.codeChallenge) {
            console.log('ERROR: PKCE verification failed');
            res.writeHead(400);
            res.end('Invalid code verifier');
            return;
          }
          console.log('PKCE verification successful');
        }
        
        // Generate access token
        const accessToken = randomUUID();
        const tokenData = {
          clientId: clientId,
          scope: authCode.scope,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          resource: 'https://ha-mcp.right-api.com'
        };
        accessTokens.set(accessToken, tokenData);
        
        // Store authenticated client for future session verification
        // Use access token as primary key for persistence
        authenticatedSessions.set(accessToken, {
          accessToken: accessToken,
          tokenData: tokenData,
          authenticatedAt: new Date(),
          adminSessionToken: authCode.adminSessionToken, // Link to admin session
          clientId: clientId,
          persistent: true
        });
        
        // Also store by clientId for backwards compatibility
        authenticatedSessions.set(clientId, {
          accessToken: accessToken,
          tokenData: tokenData,
          authenticatedAt: new Date(),
          adminSessionToken: authCode.adminSessionToken,
          clientId: clientId,
          persistent: true
        });
        
        saveSessionData(); // Persist immediately
        
        console.log(`SUCCESS: OAuth completed for client: ${clientId}`);
        console.log(`Generated access token: ${accessToken}`);
        console.log(`Authenticated sessions now: ${authenticatedSessions.size}`);
        console.log(`Access tokens now: ${accessTokens.size}`);
        
        authCodes.delete(code);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 86400,
          scope: authCode.scope
        }));
        console.log('Token response sent successfully');
      } catch (error) {
        console.log('ERROR in token exchange:', error);
        res.writeHead(400);
        res.end('Invalid token request');
      }
    });
    return;
  }
  
  // Health check
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', server: 'ha-mcp-server' }));
    return;
  }
  
  // OpenAI Plugin: /.well-known/ai-plugin.json manifest
  if (req.method === 'GET' && parsedUrl.pathname === '/.well-known/ai-plugin.json') {
    console.log('OpenAI Plugin: ai-plugin.json manifest request');
    
    const manifest = {
      schema_version: "v1",
      name_for_human: "Home Assistant",
      name_for_model: "homeassistant",
      description_for_human: "Control and manage Home Assistant devices through AI",
      description_for_model: "Plugin for accessing Home Assistant devices, entities, and services. Allows listing, reading, and controlling smart home devices.",
      auth: {
        type: "oauth",
        authorization_url: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/oauth/authorize`,
        scope: "mcp"
      },
      api: {
        type: "openapi",
        url: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/tools`,
        is_user_authenticated: true
      },
      logo_url: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/logo.png`,
      contact_email: "admin@ha-mcp.right-api.com",
      legal_info_url: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/legal`
    };
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(manifest, null, 2));
    console.log('OpenAI Plugin: Sent ai-plugin.json manifest');
    return;
  }
  
  // OpenAI Plugin: GET /tools endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/tools') {
    console.log('OpenAI Plugin: GET /tools request');
    
    try {
      const tools = await getTools();
      const openAITools = tools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(JSON.stringify({ tools: openAITools }));
      console.log(`OpenAI Plugin: Sent ${openAITools.length} tools`);
      return;
    } catch (error) {
      console.error('Error generating OpenAI tools:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate tools' }));
      return;
    }
  }
  
  // STREAMABLE HTTP MCP ENDPOINT (2025 spec compliance)
  // RFC: All client→server messages go through /message endpoint
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/message') {
    // STREAMABLE HTTP: Proper transport negotiation per MCP 2025 spec
    const acceptHeader = req.headers.accept || '';
    const supportsSSE = acceptHeader.includes('text/event-stream');
    const supportsJSON = acceptHeader.includes('application/json');
    const userAgent = req.headers['user-agent'] || '';
    
    console.log(`STREAMABLE HTTP 2025: ${req.method} request from ${userAgent}`);
    console.log(`STREAMABLE HTTP 2025: Accept: ${acceptHeader}`);
    console.log(`STREAMABLE HTTP 2025: Transport support - SSE: ${supportsSSE}, JSON: ${supportsJSON}`);
    
    // STREAMABLE HTTP 2025: Handle GET requests for SSE upgrade
    if (req.method === 'GET') {
      console.log('STREAMABLE HTTP 2025: GET request - checking for SSE upgrade');
      
      if (supportsSSE) {
        console.log('STREAMABLE HTTP 2025: Upgrading to SSE connection');
        
        // SSE Response headers per MCP spec
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID',
          'Mcp-Transport': 'streamable-http',
          'Mcp-Protocol-Version': '2024-11-05'
        });
        
        // Send SSE connection established event
        res.write('data: {"type":"connection","status":"established"}\n\n');
        
        // Get session ID for duplicate prevention
        const sessionId = req.headers['mcp-session-id'];
        if (!sessionId) {
          console.log('STREAMABLE HTTP 2025: SSE request without session ID - skipping tool broadcast');
          // Keep connection alive but don't send tools without session ID (more frequent pings)
          const keepAlive = setInterval(() => {
            res.write('data: {"type":"ping"}\n\n');
          }, 10000);
          
          req.on('close', () => {
            clearInterval(keepAlive);
            console.log('STREAMABLE HTTP 2025: SSE connection closed (no session)');
          });
          return;
        }
        
        // STREAMABLE HTTP 2025: Send tools list as proper MCP notification (avoid duplicates)
        const sessionKey = `sse_${sessionId}`;
        if (!global.sseSent) global.sseSent = new Set();
        
        if (!global.sseSent.has(sessionKey)) {
          global.sseSent.add(sessionKey);
          
          setTimeout(async () => {
            try {
              // Pass session token for integration detection
              let sessionTokenForTools = null;
              if (sessionId) {
                const existingSession = sessions.get(sessionId);
                if (existingSession && existingSession.authenticated && existingSession.adminSessionToken) {
                  sessionTokenForTools = existingSession.adminSessionToken;
                }
              }
              const tools = await getTools(sessionTokenForTools);
              
              // Send tools as a tools/list_changed notification per MCP spec
              const toolsNotification = {
                jsonrpc: '2.0',
                method: 'notifications/tools/list_changed',
                params: {}
              };
              
              console.log(`STREAMABLE HTTP 2025: Sending tools/list_changed notification over SSE (session: ${sessionId})`);
              try {
                res.write(`data: ${JSON.stringify(toolsNotification)}\n\n`);
              } catch (err) {
                console.log('STREAMABLE HTTP 2025: Failed to send tools notification, connection lost');
                return;
              }
              
              // Then send tools as a proper response that Claude should pick up
              const toolsMessage = {
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 'sse-auto-' + Date.now(),
                result: {
                  tools: tools
                }
              };
              
              console.log(`STREAMABLE HTTP 2025: Auto-sending tools/list over SSE (${tools.length} tools, session: ${sessionId})`);
              try {
                res.write(`data: ${JSON.stringify(toolsMessage)}\n\n`);
              } catch (err) {
                console.log('STREAMABLE HTTP 2025: Failed to send tools list, connection lost');
                return;
              }
              
            } catch (err) {
              console.error('STREAMABLE HTTP 2025: Error sending tools over SSE:', err);
            }
          }, 1000);
        } else {
          console.log(`STREAMABLE HTTP 2025: Skipping duplicate tool broadcast for session ${sessionId}`);
        }
        
        // Keep connection alive with more frequent pings
        const keepAlive = setInterval(() => {
          try {
            res.write('data: {"type":"ping"}\n\n');
          } catch (err) {
            clearInterval(keepAlive);
            console.log('STREAMABLE HTTP 2025: Keep-alive ping failed, connection already closed');
          }
        }, 8000); // Ping every 8 seconds for Claude.ai stability
        
        req.on('close', () => {
          clearInterval(keepAlive);
          // Clear session tracking to allow reconnection
          if (global.sseSent && sessionId) {
            global.sseSent.delete(`sse_${sessionId}`);
          }
          console.log('STREAMABLE HTTP 2025: SSE connection closed');
        });
        
        return;
      } else {
        // GET without SSE support - return server info
        console.log('STREAMABLE HTTP 2025: GET request without SSE - returning server info');
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Mcp-Transport': 'streamable-http',
          'Mcp-Protocol-Version': '2024-11-05'
        });
        res.end(JSON.stringify({
          name: 'HA MCP Server',
          version: '1.0.0',
          description: 'Home Assistant Model Context Protocol Server with Streamable HTTP',
          transport: 'streamable-http',
          protocol: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            prompts: {}
          }
        }));
        return;
      }
    }
    
    // STREAMABLE HTTP 2025: Handle OPTIONS for CORS preflight
    if (req.method === 'OPTIONS') {
      console.log('STREAMABLE HTTP 2025: OPTIONS preflight request');
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
        'Access-Control-Max-Age': '86400',
        'Mcp-Transport': 'streamable-http',
        'Mcp-Protocol-Version': '2024-11-05'
      });
      res.end();
      return;
    }
    
    if (req.method === 'POST') {
      // Debug all headers for POST requests
      console.log('STREAMABLE HTTP 2025: POST request headers:', JSON.stringify(req.headers, null, 2));
      
      // Check authorization for MCP requests - try Bearer token first, then session auth
      console.log('Authorization header:', req.headers.authorization);
      const sessionId = req.headers['mcp-session-id'];
      console.log('Session ID:', sessionId);
      
      let tokenData = verifyToken(req.headers.authorization);
      if (!tokenData && sessionId) {
        console.log('Bearer token not found, checking session auth...');
        tokenData = verifySessionAuth(sessionId);
      }
      
      // MCP DISCOVERY: Will check for unauthenticated discovery after body is read
      let allowUnauthenticated = false;
      
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        
        // FORCE AUTHENTICATION: No unauthenticated requests allowed
        console.log('FORCE AUTH: All requests require authentication to ensure HA credentials are available');
        allowUnauthenticated = false;
        
        // Only check authentication after we've determined if it's a discovery request
        if (!tokenData && !allowUnauthenticated) {
          console.log('Neither Bearer token nor session auth verified - auth required for this method');
          
          console.log('No valid Bearer token or session auth - returning 401 to trigger OAuth flow');
          res.writeHead(401, { 
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="MCP Server", scope="mcp"'
          });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32001,
              message: 'Unauthorized - OAuth authentication required',
              data: {
                auth_url: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/.well-known/oauth-authorization-server`
              }
            }
          }));
          return;
        } else if (tokenData) {
          console.log('Authentication verified successfully via Bearer token');
        } else {
          console.log('Proceeding with unauthenticated discovery request');
        }
        try {
          const message = JSON.parse(body);
          console.log('Received MCP message:', JSON.stringify(message, null, 2));
          
          let sessionId = req.headers['mcp-session-id'];
          if (!sessionId && message.method === 'initialize') {
            sessionId = randomUUID();
            console.log(`Created new session: ${sessionId}`);
            
            // If we have any authenticated clients and this is a new session,
            // link it to the admin session from the OAuth flow
            let mostRecentAdminToken = null;
            let mostRecentTime = 0;
            
            // First try to find admin token from persistent authenticated sessions
            if (authenticatedSessions.size > 0) {
              for (const [, authData] of authenticatedSessions.entries()) {
                console.log('Checking authenticated session:', { 
                  hasAdminToken: !!authData.adminSessionToken, 
                  authTime: authData.authenticatedAt,
                  persistent: authData.persistent,
                  tokenValid: authData.tokenData ? new Date(authData.tokenData.expiresAt) > new Date() : false
                });
                if (authData.adminSessionToken && authData.persistent && authData.tokenData && new Date(authData.tokenData.expiresAt) > new Date()) {
                  const authTime = authData.authenticatedAt.getTime();
                  if (authTime > mostRecentTime) {
                    mostRecentTime = authTime;
                    mostRecentAdminToken = authData.adminSessionToken;
                  }
                }
              }
            }
            
            // If no admin token found in authenticated sessions, check admin sessions directly
            if (!mostRecentAdminToken && adminSessions.size > 0) {
              console.log('No admin token in authenticated sessions, checking admin sessions directly');
              for (const [adminToken, adminData] of adminSessions.entries()) {
                console.log('Checking admin session:', { token: adminToken.substring(0, 8) + '...', authenticated: adminData.authenticated, hasHA: !!(adminData.haHost && adminData.haApiToken) });
                if (adminData.authenticated && adminData.haHost && adminData.haApiToken) {
                  const createTime = adminData.createdAt.getTime();
                  if (createTime > mostRecentTime) {
                    mostRecentTime = createTime;
                    mostRecentAdminToken = adminToken;
                  }
                }
              }
            }
            
            if (mostRecentAdminToken) {
              // Store session as authenticated and link to admin session
              sessions.set(sessionId, {
                authenticated: true,
                createdAt: new Date(),
                adminSessionToken: mostRecentAdminToken
              });
              console.log(`SUCCESS: Marked session ${sessionId} as authenticated and linked to admin session ${mostRecentAdminToken.substring(0, 8)}...`);
              console.log(`Admin session HA credentials available: ${adminSessions.get(mostRecentAdminToken)?.haHost ? 'YES' : 'NO'}`);
            } else {
              console.log('WARNING: No admin session with HA credentials found - using environment variables');
              console.log(`Available admin sessions: ${adminSessions.size}`);
              console.log(`Available authenticated sessions: ${authenticatedSessions.size}`);
              if (adminSessions.size > 0) {
                console.log('Admin sessions details:');
                for (const [token, data] of adminSessions.entries()) {
                  console.log(`  Token: ${token.substring(0, 8)}..., Has HA: ${!!(data.haHost && data.haApiToken)}, Authenticated: ${data.authenticated}`);
                }
              }
              // Store as authenticated but without admin token (will use environment variables)
              sessions.set(sessionId, {
                authenticated: true,
                createdAt: new Date()
              });
            }
          }
          
          let response;
          
          if (message.method === 'initialize') {
            // FINAL FIX: Try standard MCP format - capabilities indicate support, tools sent separately
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {
                    listChanged: true
                  },
                  prompts: {}
                },
                serverInfo: {
                  name: 'ha-mcp-server',
                  version: '1.0.0'
                }
              }
            };
            console.log('FINAL FIX: Standard MCP initialize - Claude should request tools/list next');
          } else if (message.method === 'notifications/initialized') {
            // CRITICAL DISCOVERY FIX: Claude.ai never sends initialize, so treat this as the tools request
            console.log('CRITICAL DISCOVERY FIX: Client sent notifications/initialized - treating as tools discovery');
            
            // If no authentication, send tools but include auth requirement in response
            if (!tokenData) {
              console.log('DISCOVERY: Sending tools for unauthenticated discovery, but tools will require auth');
              const tools = await getTools();
              response = {
                jsonrpc: '2.0',
                id: message.id || 'discovery-' + Date.now(),
                result: {
                  tools: tools,
                  _auth_required: true,
                  _auth_url: `${process.env.SERVER_URL || 'https://ha-mcp.right-api.com'}/.well-known/oauth-authorization-server`
                }
              };
              console.log(`DISCOVERY: Sent ${tools.length} tools with auth requirement:`, tools.map(t => t.name).join(', '));
            } else {
              const tools = await getTools();
              response = {
                jsonrpc: '2.0',
                id: message.id || 'discovery-' + Date.now(),
                result: {
                  tools: tools
                }
              };
              console.log(`AUTHENTICATED: Sent ${tools.length} tools:`, tools.map(t => t.name).join(', '));
            }
          } else if (message.method === 'prompts/list') {
            // HACK: Since Claude.ai only requests prompts/list and never tools/list,
            // we'll send the tools response when it asks for prompts
            console.log('HACK: Claude.ai requested prompts/list, sending tools instead!');
            // Pass session token for integration detection
            let sessionTokenForTools = null;
            if (sessionId) {
              const sessionData = sessions.get(sessionId);
              if (sessionData && sessionData.authenticated && sessionData.adminSessionToken) {
                sessionTokenForTools = sessionData.adminSessionToken;
              }
            }
            const tools = await getTools(sessionTokenForTools);
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`HACK: Sending tools response (${tools.length} tools) to prompts/list request`);
            console.log('Tools being sent:', tools.map(t => t.name).join(', '));
          } else if (message.method === 'tools/list') {
            console.log('SUCCESS: Claude.ai is requesting tools/list!');
            // Pass session token for integration detection
            let sessionTokenForTools = null;
            if (sessionId) {
              const sessionData = sessions.get(sessionId);
              if (sessionData && sessionData.authenticated && sessionData.adminSessionToken) {
                sessionTokenForTools = sessionData.adminSessionToken;
              }
            }
            const tools = await getTools(sessionTokenForTools);
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`SUCCESS: Sending tools response with ${tools.length} tools (unauthenticated discovery)`);
            console.log('Tools being sent:', tools.map(t => t.name).join(', '));
          } else if (message.method === 'tools/call') {
            console.log(`🎯 RECEIVED TOOL CALL: ${message.params?.name || 'UNKNOWN'}`);
            console.log(`🎯 Tool call details:`, JSON.stringify(message.params, null, 2));
            // Get session token from authenticated sessions for HA API access
            let sessionToken = null;
            if (sessionId) {
              const sessionData = sessions.get(sessionId);
              console.log(`MCP Session ${sessionId} data:`, { 
                authenticated: sessionData?.authenticated, 
                hasAdminToken: !!sessionData?.adminSessionToken 
              });
              if (sessionData && sessionData.authenticated && sessionData.adminSessionToken) {
                // Use the admin session token linked to this MCP session
                sessionToken = sessionData.adminSessionToken;
                const adminSession = adminSessions.get(sessionToken);
                console.log(`SUCCESS: Using admin session token for HA API: ${sessionToken.substring(0, 8)}...`);
                console.log(`Admin session HA Host: ${adminSession?.haHost || 'NOT SET'}`);
                console.log(`Admin session API Token: ${adminSession?.haApiToken ? 'SET' : 'NOT SET'}`);
              } else {
                console.log('WARNING: No admin session token found for this MCP session - will use environment variables');
                console.log(`Session authenticated: ${sessionData?.authenticated}`);
                console.log(`Session has admin token: ${!!sessionData?.adminSessionToken}`);
              }
            }
            
            const result = await callTool(message.params.name, message.params.arguments || {}, sessionToken);
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: result
            };
          } else {
            // ULTIMATE HACK: For any unknown method, send tools
            console.log(`ULTIMATE HACK: Unknown method '${message.method}', sending tools anyway!`);
            // Pass session token for integration detection
            let sessionTokenForTools = null;
            if (sessionId) {
              const sessionData = sessions.get(sessionId);
              if (sessionData && sessionData.authenticated && sessionData.adminSessionToken) {
                sessionTokenForTools = sessionData.adminSessionToken;
              }
            }
            const tools = await getTools(sessionTokenForTools);
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`ULTIMATE HACK: Sent tools for method '${message.method}' - ${tools.length} tools:`, tools.map(t => t.name).join(', '));
          }
          
          // STREAMABLE HTTP 2025: Set required headers per spec
          if (message.method === 'initialize' && response.result) {
            // MCP 2025 spec: Session ID MUST be set on initialize response
            res.setHeader('Mcp-Session-Id', sessionId);
            console.log(`STREAMABLE HTTP 2025: Set Mcp-Session-Id: ${sessionId}`);
          }
          
          // MCP 2025 spec: Set transport capabilities
          res.setHeader('Mcp-Transport', 'streamable-http');
          res.setHeader('Mcp-Protocol-Version', '2024-11-05');
          
          console.log(`STREAMABLE HTTP 2025: Sending MCP response for method: ${message.method}`);
          
          // STREAMABLE HTTP 2025: Proper response headers
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
            'Mcp-Transport': 'streamable-http',
            'Mcp-Protocol-Version': '2024-11-05'
          });
          res.end(JSON.stringify(response));
          
        } catch (error) {
          console.error('Error processing MCP message:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error'
            }
          }));
        }
      });
      
    } else if (req.method === 'GET') {
      const acceptsSSE = req.headers.accept?.includes('text/event-stream') && req.headers.authorization;
      
      if (!acceptsSSE) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'HA MCP Server',
          version: '1.0.0',
          description: 'Home Assistant Model Context Protocol Server with OAuth 2.1',
          status: 'running',
          transport: 'Streamable HTTP',
          authorization: 'OAuth 2.1',
          specification: '2025-03-26',
          endpoints: {
            health: '/health',
            mcp: '/',
            authorization: '/oauth/authorize',
            token: '/oauth/token',
            register: '/oauth/register',
            discovery: '/.well-known/oauth-authorization-server',
            token_registration: '/tokens/register',
            token_management: '/tokens'
          }
        }));
        return;
      }
      
      // SSE streaming requires auth
      const tokenData = verifyToken(req.headers.authorization);
      if (!tokenData) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }
      
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId) {
        res.writeHead(400);
        res.end('Session ID required for streaming');
        return;
      }
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const keepAlive = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
      }, 8000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
      });
      
    } else if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId) {
        // Don't delete the session - keep authentication and admin linking
        // Only close SSE connections (handled by req.on('close') above)
        console.log(`Session connection terminated: ${sessionId} (keeping auth)`);
      }
      res.writeHead(200);
      res.end();
    }
    
    return;
  }
  
  // Default 404
  res.writeHead(404);
  res.end('Not Found');
});

// Configure server timeouts for Claude.ai stability
httpServer.timeout = 60000; // 60 seconds request timeout
httpServer.keepAliveTimeout = 65000; // 65 seconds keep-alive
httpServer.headersTimeout = 66000; // 66 seconds headers timeout

const PORT = process.env.PORT || 3003; // Use environment PORT or 3003 as fallback
console.log('Environment PORT:', process.env.PORT);
console.log('Config port:', PORT);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HA MCP Server (OAuth 2.1 + Streamable HTTP) running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/`);
  console.log(`OAuth discovery: http://0.0.0.0:${PORT}/.well-known/oauth-authorization-server`);
  console.log(`Server timeouts: request=${httpServer.timeout}ms, keepAlive=${httpServer.keepAliveTimeout}ms`);
});