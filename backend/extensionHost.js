const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3002;

// Extension compatibility database
const EXTENSION_REGISTRY = {
  'gitlens': {
    name: 'GitLens',
    command: 'git',
    args: ['log', '--oneline', '--decorate'],
    requiresBackend: true,
    description: 'Git annotations and blame information'
  },
  'live-server': {
    name: 'Live Server',
    command: 'live-server',
    args: ['--port=8080', '--open=/'],
    requiresBackend: true,
    description: 'Development server with live reload'
  },
  'python-lsp': {
    name: 'Python Language Server',
    command: 'pylsp',
    args: [],
    requiresBackend: true,
    description: 'Python language intelligence and diagnostics'
  }
};

// Extension host state
const activeConnections = new Map();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Extension installation endpoint
app.post('/extensions/install', async (req, res) => {
  try {
    const { extensionId, config } = req.body;
    
    if (!EXTENSION_REGISTRY[extensionId]) {
      return res.status(404).json({ error: `Extension ${extensionId} not found` });
    }

    const extension = EXTENSION_REGISTRY[extensionId];
    
    // Check if extension requires backend
    if (extension.requiresBackend) {
      const process = spawn(extension.command, extension.args || [], {
        cwd: config.workspacePath || process.cwd(),
        stdio: 'pipe'
      });

      activeConnections.set(extensionId, process);
      
      process.stdout.on('data', (data) => {
        // Forward extension output to frontend
        res.write(`data: ${data.toString()}`);
      });

      process.stderr.on('data', (data) => {
        res.write(`error: ${data.toString()}`);
      });

      process.on('close', (code) => {
        activeConnections.delete(extensionId);
        res.write(`closed: ${code}`);
        res.end();
      });

      req.on('close', () => {
        if (activeConnections.has(extensionId)) {
          process.kill();
          activeConnections.delete(extensionId);
        }
      });

    } else {
      // Web-compatible extension - simulate installation
      res.json({ 
        success: true,
        extension: {
          id: extensionId,
          name: extension.name,
          webCompatible: true,
          status: 'installed'
        }
      });
    }

  } catch (error) {
    console.error('Extension installation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extension uninstallation endpoint
app.post('/extensions/uninstall', (req, res) => {
  try {
    const { extensionId } = req.body;
    
    if (activeConnections.has(extensionId)) {
      const process = activeConnections.get(extensionId);
      process.kill();
      activeConnections.delete(extensionId);
    }

    res.json({ success: true, uninstalled: extensionId });

  } catch (error) {
    console.error('Extension uninstallation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extension status endpoint
app.get('/extensions/status', (req, res) => {
  try {
    const status = {};
    
    for (const [extensionId, extension] of Object.entries(EXTENSION_REGISTRY)) {
      const isActive = activeConnections.has(extensionId);
      status[extensionId] = {
        ...extension,
        status: isActive ? 'running' : 'stopped',
        pid: isActive ? activeConnections.get(extensionId).pid : null
      };
    }

    res.json({ extensions: status });

  } catch (error) {
    console.error('Extension status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Language Server Protocol endpoint
app.post('/lsp/start', async (req, res) => {
  try {
    const { language, workspacePath, fileUri } = req.body;
    
    // LSP server configurations
    const lspServers = {
      typescript: {
        command: 'typescript-language-server',
        args: ['--stdio'],
        module: 'typescript'
      },
      javascript: {
        command: 'typescript-language-server',
        args: ['--stdio'],
        module: 'typescript'
      },
      python: {
        command: 'pylsp',
        args: ['--stdio'],
        module: 'python'
      },
      json: {
        command: 'vscode-json-languageserver',
        args: ['--stdio'],
        module: 'json'
      }
    };

    const serverConfig = lspServers[language];
    if (!serverConfig) {
      return res.status(400).json({ error: `Language ${language} not supported` });
    }

    // Start LSP server
    const lspProcess = spawn(serverConfig.command, serverConfig.args, {
      cwd: workspacePath,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_PATH: process.execPath
      }
    });

    // Handle LSP communication
    let messageBuffer = '';
    
    lspProcess.stdout.on('data', (data) => {
      messageBuffer += data.toString();
      
      // Process complete JSON messages
      const lines = messageBuffer.split('\n');
      messageBuffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            
            // Forward to frontend via WebSocket or polling
            res.write(`data: ${JSON.stringify(message)}`);
          } catch (error) {
            console.error('LSP message parse error:', error);
          }
        }
      }
    });

    lspProcess.stderr.on('data', (data) => {
      console.error('LSP error:', data.toString());
    });

    lspProcess.on('close', (code) => {
      console.log(`LSP server exited with code ${code}`);
    });

    // Store LSP connection
    const connectionId = `${language}-${Date.now()}`;
    activeConnections.set(connectionId, lspProcess);

    res.json({
      success: true,
      connectionId,
      server: {
        language,
        command: serverConfig.command,
        status: 'starting',
        pid: lspProcess.pid
      }
    });

  } catch (error) {
    console.error('LSP start error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LSP communication endpoint
app.post('/lsp/communicate/:connectionId', (req, res) => {
  try {
    const { connectionId } = req.params;
    const process = activeConnections.get(connectionId);
    
    if (!process || process.killed) {
      return res.status(404).json({ error: 'LSP connection not found' });
    }

    const { method, params } = req.body;
    
    // Send message to LSP server
    const message = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    process.stdin.write(JSON.stringify(message) + '\n');

    res.json({ success: true, sent: message });

  } catch (error) {
    console.error('LSP communication error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extension compatibility check
app.post('/extensions/check', (req, res) => {
  try {
    const { extensionIds } = req.body;
    const results = {};
    
    for (const extensionId of extensionIds) {
      const extension = EXTENSION_REGISTRY[extensionId];
      if (extension) {
        results[extensionId] = {
          ...extension,
          compatible: true,
          requiresBackend: extension.requiresBackend,
          webCompatible: !extension.requiresBackend
        };
      } else {
        results[extensionId] = {
          compatible: false,
          error: 'Extension not found'
        };
      }
    }

    res.json({ results });

  } catch (error) {
    console.error('Extension check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size,
    supportedExtensions: Object.keys(EXTENSION_REGISTRY).length
  });
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down extension host...');
  
  for (const [extensionId, process] of activeConnections) {
    console.log(`Terminating extension ${extensionId}`);
    process.kill();
  }
  
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Extension host server running on port ${PORT}`);
  console.log('Supported extensions:', Object.keys(EXTENSION_REGISTRY));
});
