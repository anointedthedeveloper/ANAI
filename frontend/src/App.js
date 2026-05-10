import { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as path from "path-browserify";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const terminalRef = useRef(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async (path = null) => {
    try {
      const res = await axios.get(`http://localhost:3001/files${path ? `?path=${encodeURIComponent(path)}` : ''}`);
      setFiles(res.data.tree);
      setCurrentPath(res.data.currentPath);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const loadFileContent = async (filePath) => {
    try {
      const res = await axios.get(`http://localhost:3001/file?path=${encodeURIComponent(filePath)}`);
      setFileContent(res.data.content);
      
      // Add to open files if not already there
      if (!openFiles.find(f => f.path === filePath)) {
        setOpenFiles([...openFiles, { 
          name: filePath.split('/').pop() || filePath.split('\\').pop(), 
          path: filePath 
        }]);
      }
      setActiveFile(filePath);
    } catch (error) {
      console.error("Error loading file:", error);
    }
  };

  const saveFile = async () => {
    if (!activeFile) return;
    
    try {
      await axios.post("http://localhost:3001/file", {
        filePath: activeFile,
        content: fileContent
      });
      console.log("File saved successfully");
    } catch (error) {
      console.error("Error saving file:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { user: input, ai: "", timestamp: new Date() };
    setMessages([...messages, userMessage]);
    setInput("");

    try {
      const res = await axios.post("http://localhost:3001/ask", {
        prompt: input
      });

      const aiResponse = res.data;
      setMessages(prev => [...prev.slice(0, -1), { 
        ...userMessage, 
        ai: JSON.stringify(aiResponse, null, 2),
        timestamp: new Date()
      }]);

      // Handle tool responses
      if (aiResponse.tool === "run") {
        setTerminalOutput(prev => [...prev, 
          `$ ${aiResponse.command}`,
          aiResponse.stdout || aiResponse.error || "Command executed"
        ]);
      }

    } catch (err) {
      setMessages(prev => [...prev.slice(0, -1), { 
        ...userMessage, 
        ai: `Error: ${err.message}`,
        timestamp: new Date()
      }]);
    }
  };

  const executeTerminalCommand = async (e) => {
    if (e.key === "Enter" && terminalInput.trim()) {
      setTerminalOutput(prev => [...prev, `$ ${terminalInput}`]);
      
      // Add to history
      setTerminalHistory(prev => [...prev, terminalInput]);
      setHistoryIndex(-1);
      
      if (terminalInput.trim() === "clear") {
        setTerminalOutput([]);
      } else if (terminalInput.trim() === "history") {
        setTerminalOutput(prev => [...prev, 
          ...terminalHistory.map((cmd, i) => `${i + 1}: ${cmd}`)
        ]);
      } else {
        try {
          const res = await axios.post("http://localhost:3001/ask", {
            prompt: `RUN: ${terminalInput}`
          });

          if (res.data.tool === "run") {
            setTerminalOutput(prev => [...prev, 
              res.data.stdout || res.data.error || "Command executed"
            ]);
          }
        } catch (error) {
          setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
        }
      }
      
      setTerminalInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (terminalHistory.length > 0) {
        const newIndex = historyIndex < terminalHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setTerminalInput("");
      }
    }
  };

  const renderCodeBlock = (text) => {
    const lines = text.split('\n');
    return (
      <pre className="code-block">
        <code>{lines.map((line, i) => (
          <div key={i}>{line || ' '}</div>
        ))}</code>
      </pre>
    );
  };

  const renderMessage = (msg, index) => {
    const isJson = msg.ai && (msg.ai.startsWith('{') || msg.ai.startsWith('['));
    
    return (
      <div key={index} className="message">
        <div className="message-user">
          <strong>You:</strong> {msg.user}
        </div>
        <div className="message-ai">
          <strong>ANAI:</strong>
          {isJson ? renderCodeBlock(msg.ai) : <div>{msg.ai}</div>}
        </div>
        <div className="message-time">
          {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    );
  };

  const renderFileTree = (fileList, depth = 0) => {
    return fileList.map((file, index) => (
      <div 
        key={index} 
        className={`file-item file-depth-${depth}`}
        onClick={() => {
          if (file.type === 'folder') {
            loadFiles(path.join(currentPath, file.path));
          } else {
            loadFileContent(path.join(currentPath, file.path));
          }
        }}
      >
        <span className="file-icon">
          {file.type === 'folder' ? '📁' : '📄'}
        </span>
        <span className="file-name">{file.name}</span>
        {file.children && renderFileTree(file.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>ANAI - AI Agent IDE</h1>
        <div className="header-actions">
          <button onClick={() => setMessages([])}>Clear Chat</button>
          <button onClick={() => setTerminalOutput([])}>Clear Terminal</button>
        </div>
      </div>

      <div className="main-content">
        {/* Sidebar */}
        <div className="sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-header">
            <h3>Explorer</h3>
          </div>
          <div className="file-tree">
            {renderFileTree(files)}
          </div>
        </div>

        {/* Content Area */}
        <div className="content-area">
          {/* Editor Area */}
          <div className="editor-area">
            {/* File Tabs */}
            {openFiles.length > 0 && (
              <div className="file-tabs">
                {openFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`file-tab ${activeFile === file.path ? 'active' : ''}`}
                    onClick={() => loadFileContent(file.path)}
                  >
                    {file.name}
                    <button 
                      className="close-tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFiles(openFiles.filter(f => f.path !== file.path));
                        if (activeFile === file.path) {
                          setActiveFile(null);
                          setFileContent("");
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Code Editor */}
            {activeFile ? (
              <div className="code-editor">
                <div className="editor-header">
                  <span>{activeFile}</span>
                  <button onClick={saveFile} className="save-button">Save</button>
                </div>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="editor-textarea"
                  placeholder="File content..."
                />
              </div>
            ) : (
              <div className="no-file-open">
                <p>No file opened. Select a file from the explorer to start editing.</p>
              </div>
            )}
          </div>

          {/* Bottom Panel - Chat and Terminal */}
          <div className="bottom-panel">
            {/* Chat Area */}
            <div className="chat-container">
              <div className="panel-header">
                <span>ANAI Assistant</span>
              </div>
              <div className="messages">
                {messages.map((msg, i) => renderMessage(msg, i))}
              </div>
              
              <div className="input-area">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask ANAI anything..."
                  className="chat-input"
                />
                <button onClick={sendMessage} className="send-button">Send</button>
              </div>
            </div>

            {/* Terminal */}
            <div className="terminal" style={{ height: terminalHeight }}>
              <div className="terminal-header">
                <span>Terminal</span>
                <div className="terminal-resize" />
              </div>
              <div className="terminal-body" ref={terminalRef}>
                {terminalOutput.map((output, i) => (
                  <div key={i} className="terminal-line">{output}</div>
                ))}
                <input
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyPress={executeTerminalCommand}
                  placeholder="Type command..."
                  className="terminal-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          {activeFile && (
            <span className="status-item">
              {activeFile.split('/').pop() || activeFile.split('\\').pop()}
            </span>
          )}
          <span className="status-item">
            {openFiles.length > 0 ? `${openFiles.length} file${openFiles.length > 1 ? 's' : ''} open` : 'No files open'}
          </span>
        </div>
        <div className="status-right">
          <span className="status-item">ANAI v1.0</span>
          <span className="status-item">Local</span>
        </div>
      </div>
    </div>
  );
}

export default App;
