import React, { useState, useRef, useEffect } from "react";
import { VscChromeClose, VscScreenFull, VscLayoutPanelLeft } from "react-icons/vsc";
import "./VSCodeEmbed.css";

const VSCodeEmbed = ({ file, onClose, onFileChange }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  const VS_CODE_WEB_URL = "https://vscode.dev";
  
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Handle messages from VS Code iframe
    const handleMessage = (event) => {
      if (event.origin !== VS_CODE_WEB_URL) return;
      
      const { type, data } = event.data;
      
      switch (type) {
        case 'fileContent':
          onFileChange?.(data.content, data.language);
          break;
        case 'ready':
          // Send file to VS Code when it's ready
          if (file?.content) {
            iframe.contentWindow.postMessage({
              type: 'loadFile',
              data: {
                name: file.name,
                content: file.content,
                language: file.language || 'javascript'
              }
            }, VS_CODE_WEB_URL);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => window.removeEventListener('message', handleMessage);
  }, [file, onFileChange]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (containerRef.current) {
      containerRef.current.classList.toggle('fullscreen');
    }
  };

  const loadVSCode = () => {
    const iframe = iframeRef.current;
    if (iframe && file?.content) {
      iframe.src = `${VS_CODE_WEB_URL}?file=${encodeURIComponent(file.name)}&content=${encodeURIComponent(file.content)}`;
    }
  };

  return (
    <div className={`vscode-embed-container ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      <div className="vscode-embed-header">
        <div className="vscode-embed-title">
          <span className="vscode-icon">VS</span>
          VS Code for Web
        </div>
        <div className="vscode-embed-actions">
          <button 
            onClick={loadVSCode}
            className="vscode-embed-btn"
            title="Load current file in VS Code"
          >
            Load File
          </button>
          <button 
            onClick={toggleFullscreen}
            className="vscode-embed-btn"
            title="Toggle fullscreen"
          >
            <VscScreenFull />
          </button>
          <button 
            onClick={onClose}
            className="vscode-embed-btn close"
            title="Close VS Code"
          >
            <VscChromeClose />
          </button>
        </div>
      </div>
      
      <div className="vscode-embed-content">
        <iframe
          ref={iframeRef}
          src={VS_CODE_WEB_URL}
          className="vscode-iframe"
          title="VS Code for Web"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="clipboard-read; clipboard-write; geolocation; microphone; camera; midi; encrypted-media;"
        />
      </div>
      
      <div className="vscode-embed-footer">
        <div className="vscode-embed-info">
          <span className="vscode-status-indicator online"></span>
          Connected to VS Code Web
        </div>
        <div className="vscode-embed-features">
          <span>✓ Web Extensions Support</span>
          <span>✓ Monaco Editor</span>
          <span>✓ Language Detection</span>
        </div>
      </div>
    </div>
  );
};

export default VSCodeEmbed;
