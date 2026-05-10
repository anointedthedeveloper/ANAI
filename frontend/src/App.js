import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import axios from "axios";
import * as path from "path-browserify";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  VscChromeClose,
  VscExtensions,
  VscFile,
  VscFolderOpened,
  VscRepo,
  VscRepoClone,
  VscSave,
  VscSearch,
  VscSettings,
  VscSync,
  VscTerminal
} from "react-icons/vsc";
import AiChat from "./AiChat";
import "./App.css";

const CodeEditor = lazy(() => import("./CodeEditor"));

function App() {
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
  const [repoUrl, setRepoUrl] = useState("");
  const [repoToken, setRepoToken] = useState("");
  const [repoList, setRepoList] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [repoCloneStatus, setRepoCloneStatus] = useState("");
  const terminalRef = useRef(null);

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
      const query = pathArg ? `?path=${encodeURIComponent(pathArg)}` : "";
      const res = await axios.get(`http://localhost:3001/files${query}`);
      setFiles(res.data.tree || []);
      setCurrentPath(res.data.currentPath || "");
    } catch (error) {
      console.error("Error loading files:", error);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
    fetchTerminalProfiles();
    loadFiles(selectedRepo?.path || null);
  }, [fetchRepositories, fetchTerminalProfiles, loadFiles, selectedRepo]);

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

  const executeTerminalCommand = useCallback(async (e) => {
    if (e.key !== "Enter") return;
    if (!terminalInput.trim()) return;

    const command = terminalInput.trim();
    setTerminalOutput((prev) => [...prev, `$ ${command}`]);
    setTerminalHistory((prev) => [...prev, command]);
    setTerminalLoading(true);

    if (command === "clear") {
      setTerminalOutput([]);
      setTerminalInput("");
      setTerminalLoading(false);
      return;
    }

    if (command === "history") {
      setTerminalOutput((prev) => [...prev, ...terminalHistory.map((cmd, i) => `${i + 1}: ${cmd}`)]);
      setTerminalInput("");
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
      setTerminalInput("");
      setTerminalLoading(false);
    }
  }, [activeTerminalProfile, currentPath, selectedRepo, terminalHistory, terminalInput]);

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
          <span className="file-icon">{file.type === "folder" ? <VscFolderOpened /> : <VscFile />}</span>
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
        ? "Extensions"
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
          <button onClick={() => loadFiles(selectedRepo?.path || null)}>
            <VscSync className="header-icon" /> Refresh
          </button>
          <button onClick={() => setTerminalOutput([])}>
            <VscTerminal className="header-icon" /> Clear Terminal
          </button>
        </div>
      </header>

      <div className="workspace-shell">
        <nav className="activity-bar">
          <button className={`activity-item ${activeActivity === "explorer" ? "active" : ""}`} onClick={() => setActiveActivity("explorer")} title="Explorer"><VscFolderOpened /></button>
          <button className={`activity-item ${activeActivity === "search" ? "active" : ""}`} onClick={() => setActiveActivity("search")} title="Search"><VscSearch /></button>
          <button className={`activity-item ${activeActivity === "extensions" ? "active" : ""}`} onClick={() => setActiveActivity("extensions")} title="Extensions"><VscExtensions /></button>
          <button className={`activity-item ${activeActivity === "settings" ? "active" : ""}`} onClick={() => setActiveActivity("settings")} title="Repo & Settings"><VscSettings /></button>
        </nav>

        <PanelGroup direction="horizontal" className="panel-workspace">
          <Panel defaultSize={18} minSize={12} maxSize={34} className="explorer-panel">
            <div className="panel-header">
              <h2>{panelTitle}</h2>
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
            ) : activeActivity === "search" ? (
              <div className="panel-empty">Search support will be added soon.</div>
            ) : activeActivity === "extensions" ? (
              <div className="panel-empty">Extensions panel is not yet available.</div>
            ) : (
              <div className="file-tree">{fileTree}</div>
            )}
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          <Panel minSize={36} defaultSize={58} className="center-panel">
            <PanelGroup direction="vertical">
              <Panel defaultSize={68} minSize={35} className="editor-panel">
                <div className="editor-toolbar">
                  <div className="editor-path">{activeFile || "No file open"}</div>
                  <button className="save-button" onClick={saveFile} disabled={!activeFile} title="Save file">
                    <VscSave /> Save
                  </button>
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
                      <CodeEditor value={fileContent} onChange={setFileContent} language={getLanguageFromFileName(activeFile)} theme="vs-dark" />
                    </Suspense>
                  ) : (
                    <div className="no-file-open">
                      <p>Select a file from the explorer to start editing.</p>
                    </div>
                  )}
                </div>
              </Panel>

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
                <div className="terminal-body" ref={terminalRef}>
                  {terminalOutput.length === 0 ? (
                    <div className="terminal-empty">Type a command and press Enter.</div>
                  ) : terminalOutput.map((output, index) => (
                    <pre key={index} className="terminal-line">{output}</pre>
                  ))}
                </div>
                <div className="terminal-input-row">
                  <span className="terminal-prompt">$</span>
                  <input value={terminalInput} onChange={(e) => setTerminalInput(e.target.value)} onKeyDown={executeTerminalCommand} placeholder="Type command..." className="terminal-input" disabled={terminalLoading} />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          <Panel defaultSize={24} minSize={16} maxSize={38} className="ai-panel">
            <div className="panel-header">
              <h2>AI Chat</h2>
            </div>
            <AiChat />
          </Panel>
        </PanelGroup>
      </div>

      <footer className="status-bar">
        <div className="status-left">
          <span>{activeFile ? activeFile.split(/[\\/]/).pop() : "No file selected"}</span>
          <span>{openFiles.length} open file{openFiles.length === 1 ? "" : "s"}</span>
          <span>{selectedRepo ? `Repo: ${selectedRepo.name}` : "Workspace"}</span>
        </div>
        <div className="status-right">
          <span>{terminalProfiles.find((profile) => profile.id === activeTerminalProfile)?.name || "Terminal"}</span>
          <span>Backend: 3001</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
