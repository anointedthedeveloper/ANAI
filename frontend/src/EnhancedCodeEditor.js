import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import { useMonaco } from "@monaco-editor/react";
import Editor from "@monaco-editor/react";
import {
  VscChromeClose,
  VscExtensions,
  VscFile,
  VscFolderOpened,
  VscNewFolder,
  VscNewFile,
  VscRepo,
  VscRepoClone,
  VscSave,
  VscSearch,
  VscSettings,
  VscSync,
  VscTerminal,
  VscCode,
  VscStar,
  VscFullscreen,
  VscCloudDownload,
  VscCheck,
  VscWarning,
  VscPlug,
  VscServer
} from "react-icons/vsc";
import "./EnhancedCodeEditor.css";

// Available web-compatible extensions
const WEB_EXTENSIONS = [
  {
    id: 'prettier',
    name: 'Prettier',
    description: 'Code formatter',
    category: 'Formatters',
    enabled: true,
    webCompatible: true,
    icon: '⚡'
  },
  {
    id: 'es-lint',
    name: 'ESLint',
    description: 'JavaScript linting',
    category: 'Linters',
    enabled: true,
    webCompatible: true,
    icon: '🔍'
  },
  {
    id: 'bracket-pair-colorizer',
    name: 'Bracket Pair Colorizer',
    description: 'Colorizes matching brackets',
    category: 'Visual',
    enabled: false,
    webCompatible: true,
    icon: '🎨'
  },
  {
    id: 'gitlens',
    name: 'GitLens',
    description: 'Git annotations and insights',
    category: 'Git',
    enabled: false,
    webCompatible: false,
    icon: '🔍',
    note: 'Requires Node.js backend'
  },
  {
    id: 'intellisense',
    name: 'IntelliSense',
    description: 'Enhanced autocomplete',
    category: 'Intellisense',
    enabled: true,
    webCompatible: true,
    icon: '💡'
  }
];

const EnhancedCodeEditor = forwardRef(({ 
  value, 
  onChange, 
  language = "javascript", 
  theme = "vs-dark",
  extensions = WEB_EXTENSIONS 
}, ref) => {
  const editorRef = useRef(null);
  const monacoInstance = useMonaco();
  const [enabledExtensions, setEnabledExtensions] = useState(extensions);
  const [showExtensions, setShowExtensions] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(language);

  // Configure Monaco with extensions
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoInstance) return;

    // Apply Prettier formatting
    const prettierExt = enabledExtensions.find(ext => ext.id === 'prettier');
    if (prettierExt?.enabled) {
      editor.addAction({
        id: 'prettier-format',
        label: 'Format Document',
        keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
        run: () => {
          // Basic formatting logic
          const model = editor.getModel();
          if (model) {
            const formatted = formatCode(model.getValue(), language);
            editor.setValue(formatted);
          }
        }
      });
    }

    // Apply ESLint diagnostics
    const eslintExt = enabledExtensions.find(ext => ext.id === 'es-lint');
    if (eslintExt?.enabled) {
      // Basic linting simulation
      const model = editor.getModel();
      if (model) {
        const diagnostics = lintCode(model.getValue(), language);
        monacoInstance.editor.setModelMarkers(model, 'eslint', diagnostics);
      }
    }

    // Apply bracket colorization
    const bracketExt = enabledExtensions.find(ext => ext.id === 'bracket-pair-colorizer');
    if (bracketExt?.enabled) {
      if (monacoInstance.editor) {
        monacoInstance.editor.updateOptions({
          bracketPairColorization: { enabled: true }
        });
      }
    }

  }, [enabledExtensions, language, monacoInstance]);

  const toggleExtension = (extensionId) => {
    setEnabledExtensions(prev => 
      prev.map(ext => 
        ext.id === extensionId ? { ...ext, enabled: !ext.enabled } : ext
      )
    );
  };

  const formatCode = (code, lang) => {
    // Simple formatting logic (in real app, use actual Prettier)
    return code
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  };

  const lintCode = (code, lang) => {
    // Simple linting logic (in real app, use actual ESLint)
    const diagnostics = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      if (line.trim().length > 120) {
        diagnostics.push({
          severity: monacoInstance.MarkerSeverity.Warning,
          message: 'Line too long (>120 characters)',
          startLineNumber: index + 1,
          startColumn: line.length,
          endLineNumber: index + 1,
          endColumn: line.length
        });
      }
      
      if (line.includes('console.log')) {
        diagnostics.push({
          severity: monacoInstance.MarkerSeverity.Warning,
          message: 'Unexpected console.log statement',
          startLineNumber: index + 1,
          startColumn: line.indexOf('console.log'),
          endLineNumber: index + 1,
          endColumn: line.indexOf('console.log') + 'console.log'.length
        });
      }
    });
    
    return diagnostics;
  };

  useImperativeHandle(ref, () => ({
    undo: () => editorRef.current?.trigger("toolbar", "undo"),
    redo: () => editorRef.current?.trigger("toolbar", "redo"),
    focus: () => editorRef.current?.focus(),
    formatDocument: () => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (model) {
        const formatted = formatCode(model.getValue(), language);
        editor.setValue(formatted);
      }
    },
    toggleExtensions: () => setShowExtensions(!showExtensions)
  }), []);

  return (
    <div className="enhanced-editor-container">
      <div className="editor-toolbar">
        <div className="editor-language">
          <span className="language-badge">{currentLanguage}</span>
        </div>
        
        <div className="editor-actions">
          <button 
            onClick={() => setShowExtensions(!showExtensions)}
            className={`toolbar-btn ${showExtensions ? 'active' : ''}`}
            title="Manage Extensions"
          >
            <VscExtensions />
            Extensions ({enabledExtensions.filter(e => e.enabled).length})
          </button>
          
          <button 
            onClick={() => ref.current?.formatDocument?.()}
            className="toolbar-btn"
            title="Format Document (Ctrl+S)"
          >
            ⚡ Format
          </button>
        </div>
      </div>

      <div className="editor-main">
        <div className={`extensions-panel ${showExtensions ? 'visible' : ''}`}>
          <div className="extensions-header">
            <h4>Web Extensions</h4>
            <button className="extensions-close" onClick={() => setShowExtensions(false)}>
              ×
            </button>
          </div>
          
          <div className="extensions-list">
            {enabledExtensions.map(extension => (
              <div key={extension.id} className="extension-item">
                <div className="extension-info">
                  <div className="extension-header">
                    <span className="extension-icon">{extension.icon}</span>
                    <div className="extension-details">
                      <div className="extension-name">{extension.name}</div>
                      <div className="extension-description">{extension.description}</div>
                    </div>
                  </div>
                  <div className="extension-meta">
                    <span className={`extension-category ${extension.category.toLowerCase()}`}>
                      {extension.category}
                    </span>
                    {!extension.webCompatible && (
                      <span className="extension-warning">
                        <VscWarning size={12} />
                        Requires backend
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="extension-controls">
                  <button
                    onClick={() => toggleExtension(extension.id)}
                    className={`extension-toggle ${extension.enabled ? 'enabled' : 'disabled'}`}
                    disabled={!extension.webCompatible}
                  >
                    {extension.webCompatible ? (
                      extension.enabled ? <VscCheck /> : 'Enable'
                    ) : (
                      <VscCloudDownload size={12} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="monaco-editor-container">
          <Editor
            height="100%"
            defaultLanguage={currentLanguage}
            value={value}
            theme={theme}
            onMount={(editor) => {
              editorRef.current = editor;
              setCurrentLanguage(editor.getModel()?.getLanguageId() || language);
            }}
            onChange={(newValue) => {
              onChange(newValue || "");
              // Update language when Monaco detects it
              const detectedLang = editorRef.current?.getModel()?.getLanguageId();
              if (detectedLang && detectedLang !== currentLanguage) {
                setCurrentLanguage(detectedLang);
              }
            }}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 10 },
              wordWrap: "on",
              bracketPairColorization: { enabled: enabledExtensions.some(e => e.id === 'bracket-pair-colorizer' && e.enabled) },
              guides: {
                bracketPairs: true,
                indentation: true
              },
              suggest: {
                showKeywords: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled),
                showSnippets: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled)
              },
              quickSuggestions: {
                other: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled),
                comments: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled),
                strings: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled)
              },
              lightbulb: {
                enabled: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled)
              },
              codeActionsOnSave: {
                'source.fixAll.eslint': enabledExtensions.some(e => e.id === 'es-lint' && e.enabled)
              },
              lightbulb: {
                enabled: enabledExtensions.some(e => e.id === 'intellisense' && e.enabled)
              },
              codeActionsOnSave: {
                'source.fixAll.eslint': enabledExtensions.some(e => e.id === 'es-lint' && e.enabled)
              }
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default EnhancedCodeEditor;
