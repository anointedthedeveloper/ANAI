import React, { useState, useEffect, useRef } from "react";
import { VscServer, VscPlug, VscWarning, VscCheck } from "react-icons/vsc";
import "./LSPIntegration.css";

// Language Server Protocol configuration
const LANGUAGE_SERVERS = [
  {
    id: 'typescript',
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    languages: ['typescript', 'javascript'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    webCompatible: true,
    features: ['diagnostics', 'completion', 'hover', 'signature', 'definition', 'references']
  },
  {
    id: 'python',
    name: 'Python Language Server',
    command: 'pylsp',
    args: [],
    languages: ['python'],
    extensions: ['.py'],
    webCompatible: false,
    features: ['diagnostics', 'completion', 'hover', 'signature', 'definition', 'references'],
    note: 'Requires Python backend'
  },
  {
    id: 'json',
    name: 'JSON Language Server',
    command: 'vscode-json-languageserver',
    args: [],
    languages: ['json', 'jsonc'],
    extensions: ['.json'],
    webCompatible: true,
    features: ['validation', 'completion', 'formatting']
  },
  {
    id: 'css',
    name: 'CSS Language Server',
    command: 'css-languageserver',
    args: [],
    languages: ['css', 'scss', 'less'],
    extensions: ['.css', '.scss', '.less'],
    webCompatible: true,
    features: ['validation', 'completion', 'hover']
  },
  {
    id: 'html',
    name: 'HTML Language Server',
    command: 'html-languageserver',
    args: [],
    languages: ['html', 'handlebars'],
    extensions: ['.html', '.htm'],
    webCompatible: true,
    features: ['completion', 'hover', 'validation']
  }
];

const LSPIntegration = ({ 
  activeFile, 
  onDiagnostics, 
  onCompletion, 
  onHover,
  workspacePath 
}) => {
  const [connectedServers, setConnectedServers] = useState([]);
  const [serverStatus, setServerStatus] = useState({});
  const lspConnections = useRef(new Map());

  useEffect(() => {
    // Initialize LSP connections for web-compatible servers
    const initWebLSP = async () => {
      const servers = LANGUAGE_SERVERS.filter(server => server.webCompatible);
      const connections = [];

      for (const server of servers) {
        try {
          // Simulate LSP connection (in real implementation, use WebSocket or Web Worker)
          const connection = await initializeLSPServer(server, activeFile);
          if (connection) {
            connections.push(server.id);
            lspConnections.current.set(server.id, connection);
            setServerStatus(prev => ({
              ...prev,
              [server.id]: 'connected'
            }));
          }
        } catch (error) {
          console.error(`Failed to connect to ${server.name}:`, error);
          setServerStatus(prev => ({
            ...prev,
            [server.id]: 'error'
          }));
        }
      }

      setConnectedServers(connections);
    };

    if (activeFile) {
      initWebLSP();
    }

    return () => {
      // Cleanup LSP connections
      lspConnections.current.forEach((connection, serverId) => {
        try {
          connection.dispose();
        } catch (error) {
          console.error(`Error disposing LSP server ${serverId}:`, error);
        }
      });
      lspConnections.current.clear();
    };
  }, [activeFile, workspacePath]);

  const initializeLSPServer = async (server, file) => {
    // Simulate LSP initialization (in real implementation, this would connect to actual language server)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const fileExtension = file?.name?.split('.').pop().toLowerCase();
        
        if (!server.languages.includes(fileExtension)) {
          reject(new Error(`Language ${fileExtension} not supported by ${server.name}`));
          return;
        }

        const mockConnection = {
          server,
          file,
          status: 'connected',
          
          // Mock LSP methods
          requestCompletion: (position) => {
            const completions = generateMockCompletions(fileExtension, position);
            onCompletion?.(completions);
          },
          
          requestHover: (position) => {
            const hoverInfo = generateMockHover(fileExtension, position);
            onHover?.(hoverInfo);
          },
          
          requestDiagnostics: (content) => {
            const diagnostics = generateMockDiagnostics(fileExtension, content);
            onDiagnostics?.(diagnostics);
          },
          
          dispose: () => {
            console.log(`LSP server ${server.id} disposed`);
          }
        };

        resolve(mockConnection);
      }, 100);
    });
  };

  const generateMockCompletions = (language, position) => {
    const completions = {
      javascript: [
        { label: 'console.log()', kind: 'function', insertText: 'console.log()' },
        { label: 'const', kind: 'keyword', insertText: 'const ' },
        { label: 'function', kind: 'keyword', insertText: 'function ' },
        { label: 'import', kind: 'keyword', insertText: 'import ' },
        { label: 'export', kind: 'keyword', insertText: 'export ' }
      ],
      typescript: [
        { label: 'interface', kind: 'keyword', insertText: 'interface ' },
        { label: 'type', kind: 'keyword', insertText: 'type ' },
        { label: 'public', kind: 'keyword', insertText: 'public ' },
        { label: 'private', kind: 'keyword', insertText: 'private ' }
      ],
      json: [
        { label: '"', kind: 'snippet', insertText: '": ' },
        { label: '{', kind: 'snippet', insertText: '{' },
        { label: '[]', kind: 'snippet', insertText: '[]' }
      ],
      css: [
        { label: 'display', kind: 'property', insertText: 'display: ' },
        { label: 'position', kind: 'property', insertText: 'position: ' },
        { label: 'color', kind: 'property', insertText: 'color: ' },
        { label: 'background', kind: 'property', insertText: 'background: ' }
      ],
      html: [
        { label: 'div', kind: 'snippet', insertText: '<div></div>' },
        { label: 'span', kind: 'snippet', insertText: '<span></span>' },
        { label: 'class', kind: 'attribute', insertText: 'class=""' },
        { label: 'id', kind: 'attribute', insertText: 'id=""' }
      ]
    };

    return completions[language] || [];
  };

  const generateMockHover = (language, position) => {
    const hoverInfo = {
      javascript: 'JavaScript keyword or variable',
      typescript: 'TypeScript type or interface',
      json: 'JSON property value',
      css: 'CSS property',
      html: 'HTML element or attribute'
    };

    return {
      content: hoverInfo[language] || 'No information available',
      range: {
        start: position,
        end: { line: position.line, character: position.character + 1 }
      }
    };
  };

  const generateMockDiagnostics = (language, content) => {
    const diagnostics = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (language === 'json') {
        try {
          JSON.parse(line);
        } catch (error) {
          diagnostics.push({
            severity: 'error',
            message: 'Invalid JSON syntax',
            line: index + 1,
            character: error.message.match(/position (\d+)/)?.[1] || 0
          });
        }
      }

      if (language === 'javascript' || language === 'typescript') {
        if (line.includes('console.log')) {
          diagnostics.push({
            severity: 'warning',
            message: 'Unexpected console.log statement',
            line: index + 1,
            character: line.indexOf('console.log')
          });
        }

        if (line.trim().length > 120) {
          diagnostics.push({
            severity: 'warning',
            message: 'Line too long (>120 characters)',
            line: index + 1,
            character: 120
          });
        }
      }
    });

    return diagnostics;
  };

  const toggleServer = (serverId) => {
    const connection = lspConnections.current.get(serverId);
    if (connection) {
      if (connection.status === 'connected') {
        connection.dispose();
        lspConnections.current.delete(serverId);
        setServerStatus(prev => ({
          ...prev,
          [serverId]: 'disconnected'
        }));
      } else {
        // Reconnect
        initializeLSPServer(LANGUAGE_SERVERS.find(s => s.id === serverId), activeFile)
          .then(newConnection => {
            lspConnections.current.set(serverId, newConnection);
            setServerStatus(prev => ({
              ...prev,
              [serverId]: 'connected'
            }));
          })
          .catch(error => {
            console.error('Failed to reconnect:', error);
            setServerStatus(prev => ({
              ...prev,
              [serverId]: 'error'
            }));
          });
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <VscCheck className="status-connected" />;
      case 'error':
        return <VscWarning className="status-error" />;
      default:
        return <VscServer className="status-disconnected" />;
    }
  };

  return (
    <div className="lsp-container">
      <div className="lsp-header">
        <div className="lsp-title">
          <VscServer />
          <h3>Language Servers</h3>
        </div>
        <div className="lsp-status">
          {connectedServers.length} servers connected
        </div>
      </div>

      <div className="lsp-servers">
        {LANGUAGE_SERVERS.map(server => {
          const status = serverStatus[server.id] || 'disconnected';
          const isCompatible = server.webCompatible;
          
          return (
            <div key={server.id} className={`lsp-server-item ${status}`}>
              <div className="server-info">
                <div className="server-header">
                  <h4>{server.name}</h4>
                  <div className="server-status">
                    {getStatusIcon(status)}
                    <span className={`status-text ${status}`}>{status}</span>
                  </div>
                </div>
                
                <div className="server-details">
                  <div className="server-languages">
                    <strong>Languages:</strong> {server.languages?.join(', ') || 'N/A'}
                  </div>
                  <div className="server-extensions">
                    <strong>Extensions:</strong> {server.extensions?.join(', ') || 'N/A'}
                  </div>
                  <div className="server-features">
                    <strong>Features:</strong> {server.features?.join(', ') || 'N/A'}
                  </div>
                </div>

                {!isCompatible && (
                  <div className="server-warning">
                    <VscWarning />
                    <span>{server.note || 'Requires Node.js backend'}</span>
                  </div>
                )}
              </div>

              <div className="server-actions">
                <button
                  onClick={() => toggleServer(server.id)}
                  className={`server-toggle-btn ${status}`}
                  disabled={!isCompatible}
                >
                  {isCompatible ? (
                    status === 'connected' ? 'Disconnect' : 'Connect'
                  ) : (
                    'Not Available'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lsp-info">
        <div className="info-section">
          <h4>Web-Compatible Servers</h4>
          <p>Language servers that work in the browser without Node.js backend</p>
        </div>
        <div className="info-section">
          <h4>Backend Required</h4>
          <p>Some servers require Node.js for full functionality</p>
        </div>
      </div>
    </div>
  );
};

export default LSPIntegration;
