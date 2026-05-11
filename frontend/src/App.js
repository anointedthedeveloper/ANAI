import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import axios from "axios";
import * as path from "path-browserify";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import MarketplaceService from "./services/MarketplaceService";
import FileSystemService from "./services/FileSystemService";
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
  VscPlay,
  VscFileCode,
  VscFilePdf,
  VscFileZip,
  VscFileMedia,
  VscFileBinary,
  VscJson,
  VscGist,
  VscGistSecret,
  VscDatabase,
  VscServer,
  VscCloud,
  VscGear,
  VscSymbolColor,
  VscSymbolMisc,
  VscSymbolEvent,
  VscSymbolInterface,
  VscSymbolMethod,
  VscSymbolNamespace,
  VscSymbolNumber,
  VscSymbolParameter,
  VscSymbolString,
  VscSymbolVariable,
  VscSymbolSnippet,
  VscSymbolKeyword,
  VscSymbolRuler,
  VscSymbolClass,
  VscSymbolEnum,
  VscSymbolProperty,
  VscSymbolField,
  VscSymbolConstructor,
  VscSymbolFunction,
  VscSymbolBoolean,
  VscSymbolArray,
  VscSymbolObject,
  VscSymbolKey,
  VscSymbolNull,
  VscSymbolEnumMember,
  VscSymbolOperator,
  VscSymbolStruct,
  VscColorMode,
  VscCloudDownload
} from "react-icons/vsc";
import AiChat from "./AiChat";
import EnhancedCodeEditor from "./EnhancedCodeEditor";
import VSCodeEmbed from "./VSCodeEmbed";
import ExtensionMarketplace from "./ExtensionMarketplace";
import LSPIntegration from "./LSPIntegration";
import "./App.css";

const CodeEditor = lazy(() => import("./EnhancedCodeEditor"));

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("anai.theme") || "dark");
  const [activeActivity, setActiveActivity] = useState("explorer");
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalProfiles, setTerminalProfiles] = useState([]);
  const [activeTerminalProfile, setActiveTerminalProfile] = useState("");
  const [showExplorer, setShowExplorer] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showVSCodeEmbed, setShowVSCodeEmbed] = useState(false);
  const [showExtensionMarketplace, setShowExtensionMarketplace] = useState(false);
  const [showLSPIntegration, setShowLSPIntegration] = useState(false);
  const [installedExtensions, setInstalledExtensions] = useState([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoToken, setRepoToken] = useState("");
  const [repoList, setRepoList] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [repoCloneStatus, setRepoCloneStatus] = useState("");
  const [liveServerRunning, setLiveServerRunning] = useState(false);
  const [liveServerPort, setLiveServerPort] = useState(3000);
  const [marketplaceService] = useState(() => new MarketplaceService());
  const [fileSystemService] = useState(() => new FileSystemService());
  const [marketplaceExtensions, setMarketplaceExtensions] = useState([]);
  const [loadingExtensions, setLoadingExtensions] = useState(false);
  const [useOpenVSX, setUseOpenVSX] = useState(false);
  
  // VSCode-style dialog states
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('file'); // 'file' or 'folder'
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogInput, setDialogInput] = useState('');
  const [dialogError, setDialogError] = useState('');
  const terminalRef = useRef(null);
  const terminalInputRef = useRef(null);
  const editorRef = useRef(null);

  // Apply theme changes
  useEffect(() => {
    localStorage.setItem("anai.theme", theme);
    const htmlElement = document.documentElement;
    if (theme === "light") {
      htmlElement.classList.add("light-theme");
    } else {
      htmlElement.classList.remove("light-theme");
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  }, []);

  const downloadExtension = useCallback(async () => {
    // Create a simple VS Code extension package
    const extensionManifest = {
      name: "anai-extension",
      displayName: "ANAI Extension",
      description: "AI-powered development workspace extension for VS Code",
      version: "1.0.0",
      publisher: "anai",
      engines: {
        vscode: "^1.80.0"
      },
      main: "./out/extension.js",
      contributes: {
        commands: [
          {
            command: "anai.openWorkspace",
            title: "Open ANAI Workspace"
          },
          {
            command: "anai.runAIChat",
            title: "Run AI Chat"
          }
        ]
      }
    };

    // Create a minimal extension.js
    const extensionCode = `
const vscode = require('vscode');

function activate(context) {
  console.log('ANAI Extension is now active!');
  
  let disposable = vscode.commands.registerCommand('anai.openWorkspace', () => {
    vscode.window.showInformationMessage('ANAI Workspace opened!');
  });
  
  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
`;

    // Create a package.json for the extension
    const packageJson = JSON.stringify(extensionManifest, null, 2);

    // Create and download the extension files
    const blob = new Blob([packageJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "package.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Also download extension.js
    const codeBlob = new Blob([extensionCode], { type: "text/javascript" });
    const codeUrl = URL.createObjectURL(codeBlob);
    const codeLink = document.createElement("a");
    codeLink.href = codeUrl;
    codeLink.download = "extension.js";
    document.body.appendChild(codeLink);
    codeLink.click();
    document.body.removeChild(codeLink);
    URL.revokeObjectURL(codeUrl);
  }, []);

  const getLanguageFromFileName = (fileName) => {
    const extension = fileName.split(".").pop().toLowerCase();
    const languageMap = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      sql: "sql",
      html: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
      fish: "shell",
      dockerfile: "dockerfile"
    };
    return languageMap[extension] || "plaintext";
  };

  const getFileIcon = (fileName, isFolder = false) => {
    if (isFolder) {
      return <VscFolderOpened />;
    }

    const extension = fileName.split(".").pop().toLowerCase();
    
    const iconMap = {
      // Web files
      html: <VscFileCode />,
      htm: <VscFileCode />,
      css: <VscFileCode />,
      scss: <VscFileCode />,
      sass: <VscFileCode />,
      less: <VscFileCode />,
      
      // JavaScript/TypeScript
      js: <VscFileCode />,
      jsx: <VscFileCode />,
      ts: <VscFileCode />,
      tsx: <VscFileCode />,
      mjs: <VscFileCode />,
      cjs: <VscFileCode />,
      
      // Configuration files
      json: <VscJson />,
      jsonc: <VscJson />,
      json5: <VscJson />,
      xml: <VscFileCode />,
      yaml: <VscFileCode />,
      yml: <VscFileCode />,
      toml: <VscFileCode />,
      ini: <VscFileCode />,
      env: <VscGear />,
      
      // Documentation
      md: <VscFileCode />,
      markdown: <VscFileCode />,
      txt: <VscFile />,
      rtf: <VscFile />,
      
      // Images
      png: <VscFile />,
      jpg: <VscFile />,
      jpeg: <VscFile />,
      gif: <VscFile />,
      svg: <VscFile />,
      ico: <VscFile />,
      bmp: <VscFile />,
      webp: <VscFile />,
      
      // Media
      mp4: <VscFileMedia />,
      avi: <VscFileMedia />,
      mov: <VscFileMedia />,
      mp3: <VscFileMedia />,
      wav: <VscFileMedia />,
      ogg: <VscFileMedia />,
      
      // Archives
      zip: <VscFileZip />,
      rar: <VscFileZip />,
      tar: <VscFileZip />,
      gz: <VscFileZip />,
      '7z': <VscFileZip />,
      
      // PDF
      pdf: <VscFilePdf />,
      
      // Database
      sql: <VscDatabase />,
      db: <VscDatabase />,
      sqlite: <VscDatabase />,
      
      // Build/Packaging
      dockerfile: <VscServer />,
      docker: <VscServer />,
      makefile: <VscGear />,
      cmake: <VscGear />,
      
      // Version Control
      gitignore: <VscGist />,
      gitattributes: <VscGist />,
      
      // Default for unknown types
      default: <VscFile />
    };
    
    return iconMap[extension] || iconMap.default;
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const fetchRepositories = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:3001/repo/list");
      setRepoList(res.data.repos || []);
    } catch (error) {
      console.error("Error fetching repo list:", error);
    }
  }, []);

  const fetchTerminalProfiles = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:3001/terminal/profiles");
      const profiles = res.data.profiles || [];
      setTerminalProfiles(profiles);
      setActiveTerminalProfile((current) => current || profiles[0]?.id || "");
    } catch (error) {
      console.error("Error fetching terminal profiles:", error);
    }
  }, []);

  const loadFiles = useCallback(async (pathArg = null) => {
    try {
      if (!pathArg) {
        setFiles([]);
        setCurrentPath("");
        return;
      }
      const query = pathArg ? `?path=${encodeURIComponent(pathArg)}` : "";
      const res = await axios.get(`http://localhost:3001/files${query}`);
      setFiles(res.data.tree || []);
      setCurrentPath(res.data.currentPath || "");
    } catch (error) {
      console.error("Error loading files:", error);
    }
  }, []);

  const openFolder = useCallback(async () => {
    try {
      // Try modern File System Access API first
      if (fileSystemService.isSupported()) {
        const folderHandle = await fileSystemService.openFolder();
        
        // Create workspace object from modern API
        const workspace = {
          name: folderHandle.name,
          path: folderHandle.path,
          handle: folderHandle.handle,
          isModernAPI: true
        };
        
        setSelectedRepo(workspace);
        setActiveActivity("explorer");
        
        // Load files using modern API if available, otherwise fallback to backend
        if (folderHandle.isModernAPI) {
          try {
            const fileTree = await fileSystemService.getFileTree(folderHandle.handle);
            setFiles(fileTree);
            setCurrentPath(folderHandle.path);
          } catch (fileSystemError) {
            console.warn('Modern file system failed, falling back to backend:', fileSystemError);
            await loadFiles(folderHandle.path);
          }
        } else {
          await loadFiles(folderHandle.path);
        }
        
        // Store path for persistence (note: modern API doesn't expose full paths)
        localStorage.setItem("anai.workspacePath", folderHandle.path);
      } else {
        // Fallback to backend method
        const res = await axios.post("http://localhost:3001/workspace/select-folder");
        if (res.data.cancelled) return;

        const workspace = res.data;
        setSelectedRepo(workspace);
        setActiveActivity("explorer");
        localStorage.setItem("anai.workspacePath", workspace.path);
        await loadFiles(workspace.path);
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      
      // Final fallback to manual path entry
      const enteredPath = window.prompt("Could not open folder. Enter the full folder path to open in ANAI:");
      if (!enteredPath?.trim()) return;

      try {
        const res = await axios.post("http://localhost:3001/workspace/validate", {
          path: enteredPath.trim()
        });
        const workspace = res.data;
        setSelectedRepo(workspace);
        setActiveActivity("explorer");
        localStorage.setItem("anai.workspacePath", workspace.path);
        await loadFiles(workspace.path);
      } catch (fallbackError) {
        window.alert(fallbackError.response?.data?.error || fallbackError.message);
      }
    }
  }, [loadFiles, fileSystemService]);

  useEffect(() => {
    fetchRepositories();
    fetchTerminalProfiles();
  }, [fetchRepositories, fetchTerminalProfiles]);

  useEffect(() => {
    const storedPath = localStorage.getItem("anai.workspacePath");
    if (!storedPath) return;

    axios.post("http://localhost:3001/workspace/validate", { path: storedPath })
      .then((res) => {
        setSelectedRepo(res.data);
        loadFiles(res.data.path);
      })
      .catch(() => localStorage.removeItem("anai.workspacePath"));
  }, [loadFiles]);

  const cloneRepository = useCallback(async () => {
    if (!repoUrl.trim()) {
      setRepoCloneStatus("Repo URL is required.");
      return;
    }

    setRepoCloneStatus("Cloning repository...");
    try {
      const res = await axios.post("http://localhost:3001/repo/clone", {
        repoUrl,
        token: repoToken
      });
      setRepoCloneStatus(res.data.message || "Repository cloned successfully.");
      setRepoUrl("");
      setRepoToken("");
      await fetchRepositories();
    } catch (error) {
      setRepoCloneStatus(`Clone failed: ${error.response?.data?.error || error.message}`);
      console.error("Error cloning repository:", error);
    }
  }, [repoToken, repoUrl, fetchRepositories]);

  const loadFileContent = useCallback(async (filePath) => {
    try {
      const res = await axios.get(`http://localhost:3001/file?path=${encodeURIComponent(filePath)}`);
      setFileContent(res.data.content || "");

      setOpenFiles((prev) => {
        if (prev.some((f) => f.path === filePath)) return prev;
        return [
          ...prev,
          {
            name: filePath.split("/").pop() || filePath.split("\\").pop(),
            path: filePath
          }
        ];
      });

      setActiveFile(filePath);
    } catch (error) {
      console.error("Error loading file:", error);
    }
  }, []);

  const createFile = useCallback(async () => {
    if (!selectedRepo?.path) {
      await openFolder();
      return;
    }
    
    showCreateFileDialog();
  }, [openFolder, selectedRepo, showCreateFileDialog]);

  // VSCode-style dialog functions
  const showCreateFileDialog = useCallback(() => {
    setDialogMode('file');
    setDialogTitle('New File');
    setDialogInput('');
    setDialogError('');
    setShowFileDialog(true);
  }, []);

  const showCreateFolderDialog = useCallback(() => {
    setDialogMode('folder');
    setDialogTitle('New Folder');
    setDialogInput('');
    setDialogError('');
    setShowFileDialog(true);
  }, []);

  const handleDialogSubmit = useCallback(async () => {
    if (!dialogInput.trim()) {
      setDialogError('Name cannot be empty');
      return;
    }

    // Validate file/folder name
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(dialogInput)) {
      setDialogError('Name contains invalid characters');
      return;
    }

    try {
      if (dialogMode === 'file') {
        const res = await axios.post("http://localhost:3001/workspace/create-file", {
          workspacePath: selectedRepo.path,
          currentPath: currentPath || selectedRepo.path,
          name: dialogInput.trim()
        });
        await loadFiles(currentPath || selectedRepo.path);
        await loadFileContent(res.data.path);
      } else {
        await axios.post("http://localhost:3001/workspace/create-folder", {
          workspacePath: selectedRepo.path,
          currentPath: currentPath || selectedRepo.path,
          name: dialogInput.trim()
        });
        await loadFiles(currentPath || selectedRepo.path);
      }
      
      setShowFileDialog(false);
      setDialogInput('');
      setDialogError('');
    } catch (error) {
      setDialogError(error.response?.data?.error || error.message);
    }
  }, [dialogInput, dialogMode, currentPath, loadFileContent, loadFiles, selectedRepo]);

  const handleDialogCancel = useCallback(() => {
    setShowFileDialog(false);
    setDialogInput('');
    setDialogError('');
  }, []);

  const handleDialogKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleDialogSubmit();
    } else if (e.key === 'Escape') {
      handleDialogCancel();
    }
  }, [handleDialogSubmit, handleDialogCancel]);

  const createFolder = useCallback(async () => {
    if (!selectedRepo?.path) {
      await openFolder();
      return;
    }
    
    showCreateFolderDialog();
  }, [openFolder, selectedRepo, showCreateFolderDialog]);

  const saveFile = useCallback(async () => {
    if (!activeFile) return;
    try {
      await axios.post("http://localhost:3001/file", {
        filePath: activeFile,
        content: fileContent
      });
    } catch (error) {
      console.error("Error saving file:", error);
    }
  }, [activeFile, fileContent]);

  const runTerminalCommand = useCallback(async (commandText, options = {}) => {
    if (!commandText.trim()) return;

    const command = commandText.trim();
    setTerminalOutput((prev) => [...prev, `$ ${command}`]);
    setTerminalHistory((prev) => [...prev, command]);
    setTerminalLoading(true);

    if (command === "clear") {
      setTerminalOutput([]);
      if (!options.keepInput) setTerminalInput("");
      setTerminalLoading(false);
      return;
    }

    if (command === "history") {
      setTerminalOutput((prev) => [...prev, ...terminalHistory.map((cmd, i) => `${i + 1}: ${cmd}`)]);
      if (!options.keepInput) setTerminalInput("");
      setTerminalLoading(false);
      return;
    }

    try {
      const res = await axios.post("http://localhost:3001/terminal/run", {
        command,
        profileId: activeTerminalProfile,
        cwd: selectedRepo?.path || currentPath || undefined
      });
      const chunks = [
        res.data.stdout,
        res.data.stderr,
        res.data.error,
        res.data.exitCode ? `Process exited with code ${res.data.exitCode}` : ""
      ].filter(Boolean);
      setTerminalOutput((prev) => [...prev, chunks.join("\n") || "Command executed"]);
    } catch (error) {
      setTerminalOutput((prev) => [...prev, `Error: ${error.response?.data?.error || error.message}`]);
    } finally {
      if (!options.keepInput) setTerminalInput("");
      setTerminalLoading(false);
      requestAnimationFrame(() => terminalInputRef.current?.focus());
    }
  }, [activeTerminalProfile, currentPath, selectedRepo, terminalHistory]);

  const executeTerminalCommand = useCallback(async (e) => {
    if (e.key !== "Enter") return;
    await runTerminalCommand(terminalInput);
  }, [runTerminalCommand, terminalInput]);

  const toggleLiveServer = async () => {
    if (liveServerRunning) {
      // Stop live server
      try {
        await axios.post("http://localhost:3001/terminal/run", {
          command: `pkill -f "live-server --port=${liveServerPort}"`,
          profileId: activeTerminalProfile,
          cwd: selectedRepo?.path || currentPath
        });
        setLiveServerRunning(false);
        setTerminalOutput(prev => [...prev, `Live Server stopped on port ${liveServerPort}`]);
      } catch (error) {
        console.error('Error stopping live server:', error);
      }
    } else {
      // Start live server
      try {
        setTerminalOutput(prev => [...prev, `Starting Live Server on port ${liveServerPort}...`]);
        await axios.post("http://localhost:3001/terminal/run", {
          command: `npx live-server --port=${liveServerPort} --open=/index.html`,
          profileId: activeTerminalProfile,
          cwd: selectedRepo?.path || currentPath
        });
        setLiveServerRunning(true);
        setTerminalOutput(prev => [...prev, `Live Server started on http://localhost:${liveServerPort}`]);
      } catch (error) {
        console.error('Error starting live server:', error);
        setTerminalOutput(prev => [...prev, `Failed to start Live Server: ${error.message}`]);
      }
    }
  };

  const isExtensionInstalled = (extensionId) => {
    return installedExtensions.some(ext => ext.id === extensionId);
  };

  // Load extensions from marketplace
  const loadMarketplaceExtensions = useCallback(async (query = "", pageSize = 20) => {
    setLoadingExtensions(true);
    try {
      marketplaceService.setMarketplace(useOpenVSX);
      const result = await marketplaceService.searchExtensions(query, pageSize);
      setMarketplaceExtensions(result.extensions);
    } catch (error) {
      console.error('Error loading marketplace extensions:', error);
      setMarketplaceExtensions([]);
    } finally {
      setLoadingExtensions(false);
    }
  }, [marketplaceService, useOpenVSX]);

  // Install extension from marketplace
  const installMarketplaceExtension = useCallback(async (extension) => {
    try {
      // Check if already installed
      if (isExtensionInstalled(extension.id)) {
        console.log('Extension already installed:', extension.id);
        return;
      }

      // Add to installed extensions
      setInstalledExtensions(prev => [...prev, extension]);
      
      // If it's a web-compatible extension, we could download and activate it here
      if (extension.webCompatible && extension.downloadUrl) {
        console.log('Installing web extension:', extension.id);
        // TODO: Implement actual extension download and activation
      }
      
      console.log('Extension installed:', extension.name);
    } catch (error) {
      console.error('Error installing extension:', error);
    }
  }, [isExtensionInstalled]);

  // Uninstall extension
  const uninstallExtension = useCallback(async (extensionId) => {
    try {
      setInstalledExtensions(prev => prev.filter(ext => ext.id !== extensionId));
      console.log('Extension uninstalled:', extensionId);
    } catch (error) {
      console.error('Error uninstalling extension:', error);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event || !event.key) return; // Fix: Check if event and key exist
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === "b") {
        event.preventDefault();
        setShowExplorer((value) => !value);
      } else if (mod && event.shiftKey && key === "a") {
        event.preventDefault();
        setShowChat((value) => !value);
      } else if (mod && event.key === "`") {
        event.preventDefault();
        setShowTerminal((value) => !value);
        requestAnimationFrame(() => terminalInputRef.current?.focus());
      } else if (mod && event.shiftKey && key === "n") {
        event.preventDefault();
        createFile();
      } else if (mod && event.altKey && key === "n") {
        event.preventDefault();
        createFolder();
      } else if (mod && key === "s") {
        event.preventDefault();
        saveFile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createFile, createFolder, saveFile]);

  const renderFileTree = useCallback((fileList, depth = 0) => {
    return fileList.map((file, index) => {
      const fullPath = path.join(currentPath, file.path);
      return (
        <div
          key={`${file.name}-${index}`}
          className={`file-item file-depth-${depth}`}
          onClick={() => {
            if (file.type === "folder") {
              loadFiles(fullPath);
            } else {
              loadFileContent(fullPath);
            }
          }}
        >
          <span className="file-icon">{getFileIcon(file.name, file.type === "folder")}</span>
          <span className="file-name">{file.name}</span>
          {file.children && renderFileTree(file.children, depth + 1)}
        </div>
      );
    });
  }, [currentPath, loadFiles, loadFileContent]);

  const fileTree = useMemo(() => renderFileTree(files), [files, renderFileTree]);

  const closeFile = (filePath) => {
    const nextFiles = openFiles.filter((f) => f.path !== filePath);
    setOpenFiles(nextFiles);
    if (activeFile === filePath) {
      if (nextFiles.length) {
        loadFileContent(nextFiles[0].path);
      } else {
        setActiveFile(null);
        setFileContent("");
      }
    }
  };

  const panelTitle = activeActivity === "settings"
    ? "Repository Settings"
    : activeActivity === "search"
      ? "Search"
      : activeActivity === "extensions"
        ? "Extension Marketplace"
        : activeActivity === "vscode"
          ? "VS Code Embed"
          : activeActivity === "lsp"
            ? "Language Servers"
            : "Explorer";

  return (
    <div className="ide-container">
      <header className="header">
        <div className="header-left">
          <div className="brand-mark">A</div>
          <div>
            <h1>ANAI</h1>
            <p>AI development workspace</p>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={openFolder}>
            <VscNewFolder className="header-icon" /> Open Folder
          </button>
          <button onClick={() => loadFiles(selectedRepo?.path || null)} disabled={!selectedRepo?.path}>
            <VscSync className="header-icon" /> Refresh
          </button>
          <button onClick={() => setTerminalOutput([])}>
            <VscTerminal className="header-icon" /> Clear Terminal
          </button>
          <button onClick={() => setShowExplorer((value) => !value)} title="Toggle Explorer (Ctrl+B)">Explorer</button>
          <button onClick={() => setShowTerminal((value) => !value)} title="Toggle Terminal (Ctrl+`)">Terminal</button>
          <button onClick={() => setShowChat((value) => !value)} title="Toggle Chat (Ctrl+Shift+A)">Chat</button>
          <button onClick={() => setShowVSCodeEmbed((value) => !value)} title="Toggle VS Code Embed">VS Code</button>
          <button onClick={() => setShowExtensionMarketplace((value) => !value)} title="Toggle Extensions">Extensions</button>
          <button onClick={() => setShowLSPIntegration((value) => !value)} title="Toggle LSP">LSP</button>
          <button onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <VscColorMode className="header-icon" /> {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={downloadExtension} title="Download ANAI Extension">
            <VscCloudDownload className="header-icon" /> Download Extension
          </button>
        </div>
      </header>

      <div className="workspace-shell">
        <nav className="activity-bar">
          <button className={`activity-item ${activeActivity === "explorer" && showExplorer ? "active" : ""}`} onClick={() => { 
            if (activeActivity === "explorer" && showExplorer) {
              setShowExplorer(false);
            } else {
              setActiveActivity("explorer"); 
              setShowExplorer(true); 
            }
          }} title="Explorer"><VscFolderOpened /></button>
          <button className={`activity-item ${activeActivity === "search" && showExplorer ? "active" : ""}`} onClick={() => { 
            if (activeActivity === "search" && showExplorer) {
              setShowExplorer(false);
            } else {
              setActiveActivity("search"); 
              setShowExplorer(true); 
            }
          }} title="Search"><VscSearch /></button>
          <button className={`activity-item ${activeActivity === "extensions" && showExplorer ? "active" : ""}`} onClick={() => { 
            if (activeActivity === "extensions" && showExplorer) {
              setShowExplorer(false);
            } else {
              setActiveActivity("extensions"); 
              setShowExplorer(true); 
            }
          }} title="Extensions"><VscExtensions /></button>
          <button className={`activity-item ${activeActivity === "vscode" && showExplorer ? "active" : ""}`} onClick={() => { 
            if (activeActivity === "vscode" && showExplorer) {
              setShowExplorer(false);
            } else {
              setActiveActivity("vscode"); 
              setShowExplorer(true); 
            }
          }} title="VS Code Embed"><VscCode /></button>
          <button className={`activity-item ${activeActivity === "lsp" && showExplorer ? "active" : ""}`} onClick={() => { 
            if (activeActivity === "lsp" && showExplorer) {
              setShowExplorer(false);
            } else {
              setActiveActivity("lsp"); 
              setShowExplorer(true); 
            }
          }} title="Language Servers"><VscSettings /></button>
          <button className={`activity-item ${activeActivity === "settings" && showExplorer ? "active" : ""}`} onClick={() => { 
            if (activeActivity === "settings" && showExplorer) {
              setShowExplorer(false);
            } else {
              setActiveActivity("settings"); 
              setShowExplorer(true); 
            }
          }} title="Repo & Settings"><VscSettings /></button>
        </nav>

        <PanelGroup direction="horizontal" className="panel-workspace">
          {showExplorer && (
            <>
          <Panel defaultSize={18} minSize={12} maxSize={34} className="explorer-panel">
            <div className="panel-header">
              <h2>{panelTitle}</h2>
              {activeActivity === "explorer" && (
                <div className="panel-actions">
                  <button onClick={createFile} title="New File (Ctrl+Shift+N)"><VscNewFile /></button>
                  <button onClick={createFolder} title="New Folder (Ctrl+Alt+N)"><VscNewFolder /></button>
                  <button onClick={() => loadFiles(selectedRepo?.path || currentPath)} disabled={!selectedRepo?.path && !currentPath} title="Refresh Explorer"><VscSync /></button>
                </div>
              )}
            </div>
            {activeActivity === "settings" ? (
              <div className="settings-panel">
                <div className="settings-note">Clone a GitHub repository using a personal access token.</div>
                <label className="settings-label">Repository URL<input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo.git" /></label>
                <label className="settings-label">Personal Access Token<input value={repoToken} onChange={(e) => setRepoToken(e.target.value)} type="password" placeholder="ghp_..." /></label>
                <button className="clone-button" onClick={cloneRepository}><VscRepoClone className="button-icon" /> Clone Repository</button>
                {repoCloneStatus && <div className="repo-status">{repoCloneStatus}</div>}
                <div className="repo-list">
                  <div className="repo-list-title">Cloned Repositories</div>
                  {repoList.length === 0 ? (
                    <div className="repo-empty">No cloned repos yet.</div>
                  ) : repoList.map((repo) => (
                    <button key={repo.path} className={`repo-item ${selectedRepo?.path === repo.path ? "selected" : ""}`} onClick={() => { setSelectedRepo(repo); loadFiles(repo.path); }}>
                      <VscRepo className="repo-icon" />
                      <span>{repo.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : activeActivity === "extensions" ? (
              <ExtensionMarketplace 
                onInstallExtension={installMarketplaceExtension}
                installedExtensions={installedExtensions}
                marketplaceExtensions={marketplaceExtensions}
                loadingExtensions={loadingExtensions}
                onSearchExtensions={loadMarketplaceExtensions}
                onUninstallExtension={uninstallExtension}
                useOpenVSX={useOpenVSX}
                onToggleMarketplace={() => setUseOpenVSX(!useOpenVSX)}
              />
            ) : activeActivity === "vscode" ? (
              <VSCodeEmbed 
                file={activeFile ? { name: activeFile.split('/').pop(), content: fileContent } : null}
                onClose={() => setShowVSCodeEmbed(false)}
                onFileChange={(content, language) => {
                  setFileContent(content);
                }}
              />
            ) : activeActivity === "lsp" ? (
              <LSPIntegration
                activeFile={activeFile ? { name: activeFile.split('/').pop(), content: fileContent } : null}
                onDiagnostics={(diagnostics) => {
                  console.log('LSP diagnostics:', diagnostics);
                  // Handle diagnostics in UI
                }}
                onCompletion={(completions) => {
                  console.log('LSP completions:', completions);
                  // Handle completions in UI
                }}
                onHover={(hoverInfo) => {
                  console.log('LSP hover:', hoverInfo);
                  // Handle hover in UI
                }}
                workspacePath={selectedRepo?.path || currentPath}
              />
            ) : activeActivity === "search" ? (
              <div className="panel-empty">Search support will be added soon.</div>
            ) : !selectedRepo?.path ? (
              <div className="empty-workspace">
                <div className="empty-workspace-title">No folder open</div>
                <button onClick={openFolder}><VscNewFolder /> Open Folder</button>
              </div>
            ) : (
              <div className="file-tree">{fileTree}</div>
            )}
          </Panel>

          <PanelResizeHandle className="resize-handle" />
            </>
          )}

          <Panel minSize={36} defaultSize={58} className="center-panel">
            <PanelGroup direction="vertical">
              <Panel defaultSize={68} minSize={35} className="center-panel">
                <div className="editor-toolbar">
                  <div className="editor-path">{activeFile || "No file open"}</div>
                  <div className="editor-actions">
                    <button className="save-button" onClick={() => editorRef.current?.undo()} disabled={!activeFile} title="Undo (Ctrl+Z)">Undo</button>
                    <button className="save-button" onClick={() => editorRef.current?.redo()} disabled={!activeFile} title="Redo (Ctrl+Y)">Redo</button>
                    <button className="save-button" onClick={saveFile} disabled={!activeFile} title="Save file (Ctrl+S)">
                      <VscSave /> Save
                    </button>
                    <button className="save-button" onClick={() => editorRef.current?.formatDocument?.()} disabled={!activeFile} title="Format Document">
                      ⚡ Format
                    </button>
                    <button className="save-button" onClick={() => editorRef.current?.toggleExtensions?.()} disabled={!activeFile} title="Toggle Extensions">
                      <VscExtensions /> Extensions
                    </button>
                  </div>
                </div>

                <div className="file-tabs">
                  {openFiles.map((file, index) => (
                    <div key={`${file.path}-${index}`} className={`file-tab ${activeFile === file.path ? "active" : ""}`} onClick={() => loadFileContent(file.path)}>
                      <span>{file.name}</span>
                      <button className="close-tab" title="Close tab" onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}>
                        <VscChromeClose />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="code-editor-area">
                  {activeFile ? (
                    <Suspense fallback={<div className="editor-loading">Loading editor...</div>}>
                      <CodeEditor ref={editorRef} value={fileContent} onChange={setFileContent} language={getLanguageFromFileName(activeFile)} theme="vs-dark" />
                    </Suspense>
                  ) : (
                    <div className="no-file-open">
                      <p>Select a file from the explorer to start editing.</p>
                    </div>
                  )}
                </div>
              </Panel>

              {showTerminal && (
                <>
              <PanelResizeHandle className="resize-handle horizontal" />

              <Panel defaultSize={32} minSize={18} maxSize={60} className="terminal-panel">
                <div className="panel-header terminal-header">
                  <h2><VscTerminal /> Terminal</h2>
                  <select className="terminal-profile-select" value={activeTerminalProfile} onChange={(e) => setActiveTerminalProfile(e.target.value)}>
                    {terminalProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </div>
                <div className="terminal-body terminal-interactive" ref={terminalRef} onClick={() => terminalInputRef.current?.focus()}>
                  {terminalOutput.length === 0 ? (
                    <div className="terminal-empty">Type a command and press Enter.</div>
                  ) : terminalOutput.map((output, index) => (
                    <pre key={index} className="terminal-line">{output}</pre>
                  ))}
                  <div className={`terminal-live-line ${terminalLoading ? "running" : ""}`}>
                    <span className="terminal-prompt">$</span>
                    <input ref={terminalInputRef} value={terminalInput} onChange={(e) => setTerminalInput(e.target.value)} onKeyDown={executeTerminalCommand} placeholder={terminalLoading ? "Running..." : "Type command..."} className="terminal-input" disabled={terminalLoading} />
                  </div>
                </div>
              </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {showChat && (
            <>
          <PanelResizeHandle className="resize-handle" />

          <Panel defaultSize={30} minSize={22} maxSize={48} className="ai-panel">
            <div className="panel-header">
              <h2>AI Chat</h2>
            </div>
            <AiChat
              workspacePath={selectedRepo?.path || currentPath}
              terminalProfileId={activeTerminalProfile}
              onWorkspaceRefresh={() => loadFiles(selectedRepo?.path || currentPath)}
              onOpenFile={loadFileContent}
              onTerminalOutput={(line) => setTerminalOutput((prev) => [...prev, line])}
              onRunTerminalCommand={(command) => runTerminalCommand(command)}
            />
          </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <footer className="status-bar">
        <div className="status-left">
          <span>{activeFile ? activeFile.split(/[\\/]/).pop() : "No file selected"}</span>
          <span>{openFiles.length} open file{openFiles.length === 1 ? "" : "s"}</span>
          <span>{selectedRepo ? `Repo: ${selectedRepo.name}` : "Workspace"}</span>
        </div>
        <div className="status-right">
          {/* Extension Controls */}
          {isExtensionInstalled('live-server') && (
            <button 
              className={`extension-status-btn ${liveServerRunning ? 'running' : 'stopped'}`}
              onClick={toggleLiveServer}
              title={liveServerRunning ? 'Stop Live Server' : 'Start Live Server'}
            >
              <VscPlay />
              Live Server {liveServerRunning ? `:${liveServerPort}` : ''}
            </button>
          )}
          
          <span>Ctrl+B Explorer</span>
          <span>Ctrl+` Terminal</span>
          <span>Ctrl+Shift+A Chat</span>
          <span>{terminalProfiles.find((profile) => profile.id === activeTerminalProfile)?.name || "Terminal"}</span>
          <span>Backend: 3001</span>
        </div>
      </footer>

      {/* VSCode-style File/Folder Creation Dialog */}
      {showFileDialog && (
        <div className="vscode-dialog-overlay" onClick={handleDialogCancel}>
          <div className="vscode-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="vscode-dialog-header">
              <h3>{dialogTitle}</h3>
              <button className="vscode-dialog-close" onClick={handleDialogCancel}>
                <VscChromeClose />
              </button>
            </div>
            <div className="vscode-dialog-body">
              <input
                type="text"
                className={`vscode-input ${dialogError ? 'error' : ''}`}
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                onKeyDown={handleDialogKeyDown}
                placeholder={dialogMode === 'file' ? 'Enter file name...' : 'Enter folder name...'}
                autoFocus
              />
              {dialogError && (
                <div className="vscode-error-message">
                  {dialogError}
                </div>
              )}
            </div>
            <div className="vscode-dialog-footer">
              <button className="vscode-button secondary" onClick={handleDialogCancel}>
                Cancel
              </button>
              <button 
                className="vscode-button primary" 
                onClick={handleDialogSubmit}
                disabled={!dialogInput.trim()}
              >
                {dialogMode === 'file' ? 'Create File' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
