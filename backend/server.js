const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const { exec, execFile } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const REPO_BASE = path.resolve(process.cwd(), "repos");
if (!fs.existsSync(REPO_BASE)) {
  fs.mkdirSync(REPO_BASE, { recursive: true });
}

let history = [];

const resolveWorkspacePath = (workspacePath) => {
  if (!workspacePath || !workspacePath.trim()) return "";
  const resolved = path.resolve(workspacePath);
  return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : "";
};

const resolvePathInsideWorkspace = (workspacePath, targetPath) => {
  const workspace = resolveWorkspacePath(workspacePath);
  if (!workspace) {
    throw new Error("Select a valid workspace folder first.");
  }

  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(workspace, targetPath);

  const relative = path.relative(workspace, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path must stay inside the selected workspace.");
  }

  return resolvedTarget;
};

const executableExists = (command) => {
  const lookupCommand = process.platform === "win32" ? "where" : "command";
  const lookupArgs = process.platform === "win32" ? [command] : ["-v", command];

  return new Promise((resolve) => {
    execFile(lookupCommand, lookupArgs, (error) => resolve(!error));
  });
};

const getTerminalProfileCandidates = () => {
  if (process.platform === "win32") {
    return [
      {
        id: "powershell",
        name: "Windows PowerShell",
        command: "powershell.exe",
        args: ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]
      },
      {
        id: "pwsh",
        name: "PowerShell",
        command: "pwsh.exe",
        args: ["-NoLogo", "-NoProfile", "-Command"]
      },
      {
        id: "cmd",
        name: "Command Prompt",
        command: "cmd.exe",
        args: ["/d", "/s", "/c"]
      },
      {
        id: "git-bash",
        name: "Git Bash",
        command: "bash.exe",
        args: ["-lc"]
      }
    ];
  }

  return [
    { id: "bash", name: "Bash", command: "bash", args: ["-lc"] },
    { id: "zsh", name: "Zsh", command: "zsh", args: ["-lc"] },
    { id: "fish", name: "Fish", command: "fish", args: ["-lc"] },
    { id: "sh", name: "Shell", command: "sh", args: ["-lc"] },
    { id: "pwsh", name: "PowerShell", command: "pwsh", args: ["-NoLogo", "-NoProfile", "-Command"] }
  ];
};

const getAvailableTerminalProfiles = async () => {
  const candidates = getTerminalProfileCandidates();
  const checks = await Promise.all(candidates.map(async (profile) => ({
    ...profile,
    available: await executableExists(profile.command)
  })));
  const available = checks.filter((profile) => profile.available);
  return available.length ? available : [checks[0]];
};

const openNativeFolderPicker = () => {
  if (process.platform !== "win32") {
    return Promise.resolve("");
  }

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "$dialog = New-Object System.Windows.Forms.OpenFileDialog;",
    "$dialog.Title = 'Select a folder for ANAI';",
    "$dialog.ValidateNames = $false;",
    "$dialog.CheckFileExists = $false;",
    "$dialog.CheckPathExists = $true;",
    "$dialog.FileName = 'Select Folder';",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;",
    "  Write-Output ([System.IO.Path]::GetDirectoryName($dialog.FileName))",
    "}"
  ].join(" ");

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: false, timeout: 120000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
};

const getRepoName = (repoUrl) => {
  try {
    const parsed = new URL(repoUrl);
    const fullPath = parsed.pathname.replace(/\.git$/, "").replace(/^\//, "");
    return fullPath.split("/").pop() || "repo";
  } catch {
    return "repo";
  }
};

const injectTokenToRepoUrl = (repoUrl, token) => {
  if (!token || !token.trim()) return repoUrl;

  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return repoUrl;
    parsed.username = encodeURIComponent(token);
    parsed.password = '';
    return parsed.toString();
  } catch {
    return repoUrl;
  }
};

app.post("/ask", async (req, res) => {
  const userPrompt = req.body.prompt;
  const selectedModel = req.body.model || "llama2";

  const systemPrompt = `You are ANAI, a coding AI agent powered by Ollama.
You are helpful, direct, and optimized for fast responses.
Keep answers concise and focused.
`;

  history.push({ role: "user", content: userPrompt });
  if (history.length > 6) {
    history = history.slice(-6);
  }

  const conversationContext = history.map(msg => `${msg.role}: ${msg.content}`).join("\n");

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: selectedModel,
      prompt: `${systemPrompt}\n${conversationContext}\nAssistant:`,
      stream: false,
      temperature: 0.1,
      max_tokens: 256,
      top_p: 0.5,
      top_k: 20,
      repeat_penalty: 1.05,
      num_ctx: 2048
    });

    const output = response.data.response || response.data.output || (Array.isArray(response.data.results) && response.data.results[0]?.content) || "Unable to generate a reply.";

    history.push({ role: "assistant", content: output });

    if (output.startsWith("READ_FILE:")) {
      const file = output.replace("READ_FILE:", "").trim();
      const content = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "File not found";
      return res.json({ tool: "read", file, content });
    }

    if (output.startsWith("WRITE_FILE:")) {
      const parts = output.replace("WRITE_FILE:", "").split("|");
      const file = parts[0].trim();
      const content = parts[1]?.trim() || "";
      const dir = path.dirname(file);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file, content, "utf-8");
      return res.json({ tool: "write", file });
    }

    if (output.startsWith("RUN:")) {
      const cmd = output.replace("RUN:", "").trim();
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          return res.json({ tool: "run", command: cmd, error: err.message, stdout, stderr });
        }
        res.json({ tool: "run", command: cmd, stdout, stderr });
      });
      return;
    }

    res.json({ response: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/clear", (req, res) => {
  history = [];
  res.json({ message: "History cleared" });
});

app.get("/history", (req, res) => {
  res.json({ history });
});

app.post("/workspace/validate", (req, res) => {
  const workspacePath = resolveWorkspacePath(req.body.path);
  if (!workspacePath) {
    return res.status(400).json({ error: "Folder does not exist or is not accessible." });
  }
  res.json({
    path: workspacePath,
    name: path.basename(workspacePath) || workspacePath
  });
});

app.post("/workspace/select-folder", async (req, res) => {
  try {
    const selectedPath = await openNativeFolderPicker();
    if (!selectedPath) {
      return res.json({ cancelled: true });
    }

    const workspacePath = resolveWorkspacePath(selectedPath);
    if (!workspacePath) {
      return res.status(400).json({ error: "Selected folder is not accessible." });
    }

    res.json({
      path: workspacePath,
      name: path.basename(workspacePath) || workspacePath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const directoryCache = new Map();

const getDirectoryTree = (dirPath, relativePath = "") => {
  const resolvedPath = path.resolve(dirPath);
  if (directoryCache.has(resolvedPath)) {
    return directoryCache.get(resolvedPath);
  }

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = [];

    items.forEach((dirent) => {
      const item = dirent.name;
      const itemPath = path.join(dirPath, item);
      const itemRelativePath = path.join(relativePath, item);

      if (dirent.isDirectory()) {
        if (item === 'node_modules' || item === '.git') return;
        result.push({
          name: item,
          type: 'folder',
          path: itemRelativePath,
          children: getDirectoryTree(itemPath, itemRelativePath)
        });
      } else {
        const stats = fs.statSync(itemPath);
        result.push({
          name: item,
          type: 'file',
          path: itemRelativePath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    });

    const sorted = result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    directoryCache.set(resolvedPath, sorted);
    setTimeout(() => directoryCache.delete(resolvedPath), 5000);
    return sorted;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

app.get("/files", (req, res) => {
  const dirPath = req.query.path;
  if (!dirPath) {
    return res.json({ tree: [], currentPath: "" });
  }

  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return res.status(400).json({ error: "Folder does not exist or is not accessible." });
    }
    const tree = getDirectoryTree(dirPath);
    res.json({ tree, currentPath: dirPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/file", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/file", (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: "File path and content are required" });
  }

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ message: "File saved successfully", path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/workspace/create-file", (req, res) => {
  try {
    const { workspacePath, currentPath: requestedCurrentPath, name, content = "" } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "File name is required." });
    }

    const workspace = resolveWorkspacePath(workspacePath);
    const basePath = requestedCurrentPath && resolveWorkspacePath(requestedCurrentPath)
      ? requestedCurrentPath
      : workspace;
    const targetPath = resolvePathInsideWorkspace(workspace, path.join(path.relative(workspace, basePath), name.trim()));

    if (fs.existsSync(targetPath)) {
      return res.status(400).json({ error: "File already exists." });
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf-8");
    directoryCache.clear();
    res.json({ path: targetPath, name: path.basename(targetPath) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/workspace/create-folder", (req, res) => {
  try {
    const { workspacePath, currentPath: requestedCurrentPath, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Folder name is required." });
    }

    const workspace = resolveWorkspacePath(workspacePath);
    const basePath = requestedCurrentPath && resolveWorkspacePath(requestedCurrentPath)
      ? requestedCurrentPath
      : workspace;
    const targetPath = resolvePathInsideWorkspace(workspace, path.join(path.relative(workspace, basePath), name.trim()));

    if (fs.existsSync(targetPath)) {
      return res.status(400).json({ error: "Folder already exists." });
    }

    fs.mkdirSync(targetPath, { recursive: true });
    directoryCache.clear();
    res.json({ path: targetPath, name: path.basename(targetPath) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/models", async (req, res) => {
  const cloudModels = [
    { name: "gpt-4.1:cloud", provider: "OpenAI", cloud: true },
    { name: "gpt-4.1-mini:cloud", provider: "OpenAI", cloud: true },
    { name: "claude-3.7-sonnet:cloud", provider: "Anthropic", cloud: true },
    { name: "gemini-1.5-pro:cloud", provider: "Google", cloud: true },
    { name: "qwen3.5:cloud", provider: "Cloud", cloud: true },
    { name: "kimi-k2.6:cloud", provider: "Cloud", cloud: true }
  ];

  try {
    const response = await axios.get(OLLAMA_TAGS_URL);
    const localModels = (response.data.models || []).map((model) => ({
      ...model,
      provider: "Ollama",
      cloud: false
    }));
    res.json({ models: [...localModels, ...cloudModels] });
  } catch (error) {
    res.json({
      models: [
        { name: "llama3:latest", provider: "Ollama", cloud: false },
        { name: "mistral", provider: "Ollama", cloud: false },
        { name: "neural-chat", provider: "Ollama", cloud: false },
        ...cloudModels
      ]
    });
  }
});

app.post("/ai/actions", async (req, res) => {
  const { actions = [], workspacePath, profileId } = req.body;
  const results = [];

  for (const action of actions) {
    try {
      if (action.type === "writeFile") {
        const targetPath = resolvePathInsideWorkspace(workspacePath, action.path);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, action.content || "", "utf-8");
        directoryCache.clear();
        results.push({ type: action.type, ok: true, path: targetPath });
      } else if (action.type === "createFolder") {
        const targetPath = resolvePathInsideWorkspace(workspacePath, action.path);
        fs.mkdirSync(targetPath, { recursive: true });
        directoryCache.clear();
        results.push({ type: action.type, ok: true, path: targetPath });
      } else if (action.type === "readFile") {
        const targetPath = resolvePathInsideWorkspace(workspacePath, action.path);
        const content = fs.readFileSync(targetPath, "utf-8");
        results.push({ type: action.type, ok: true, path: targetPath, content });
      } else if (action.type === "runCommand") {
        const profiles = await getAvailableTerminalProfiles();
        const profile = profiles.find((item) => item.id === profileId) || profiles[0];
        const workingDirectory = resolveWorkspacePath(workspacePath) || process.cwd();
        const command = action.command || "";

        const output = await new Promise((resolve) => {
          execFile(
            profile.command,
            [...profile.args, command],
            {
              cwd: workingDirectory,
              windowsHide: true,
              maxBuffer: 1024 * 1024 * 10,
              timeout: 120000
            },
            (error, stdout, stderr) => resolve({
              type: action.type,
              ok: !error,
              command,
              stdout,
              stderr,
              exitCode: typeof error?.code === "number" ? error.code : 0,
              error: error && !stdout && !stderr ? error.message : ""
            })
          );
        });
        results.push(output);
      }
    } catch (error) {
      results.push({
        type: action.type,
        ok: false,
        path: action.path,
        command: action.command,
        error: error.message
      });
    }
  }

  res.json({ results });
});

app.get("/terminal/profiles", async (req, res) => {
  try {
    const profiles = await getAvailableTerminalProfiles();
    res.json({
      profiles: profiles.map(({ id, name, command }) => ({ id, name, command }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/terminal/run", async (req, res) => {
  const { command, profileId, cwd } = req.body;
  if (!command || !command.trim()) {
    return res.status(400).json({ error: "Command is required" });
  }

  try {
    const profiles = await getAvailableTerminalProfiles();
    const profile = profiles.find((item) => item.id === profileId) || profiles[0];
    const workingDirectory = cwd && fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()
      ? cwd
      : process.cwd();

    execFile(
      profile.command,
      [...profile.args, command],
      {
        cwd: workingDirectory,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10,
        timeout: 120000
      },
      (error, stdout, stderr) => {
        res.json({
          command,
          profile: {
            id: profile.id,
            name: profile.name,
            command: profile.command
          },
          cwd: workingDirectory,
          stdout,
          stderr,
          exitCode: typeof error?.code === "number" ? error.code : 0,
          error: error && !stdout && !stderr ? error.message : ""
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/repo/list", (req, res) => {
  try {
    const repos = fs.readdirSync(REPO_BASE, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => ({
        name: dirent.name,
        path: path.join(REPO_BASE, dirent.name)
      }));
    res.json({ repos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/repo/clone", (req, res) => {
  const { repoUrl, token } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ error: "Repository URL is required" });
  }

  const repoName = getRepoName(repoUrl);
  const targetPath = path.join(REPO_BASE, repoName);
  if (fs.existsSync(targetPath)) {
    return res.status(400).json({ error: "Repository already cloned" });
  }

  const remoteUrl = injectTokenToRepoUrl(repoUrl, token);
  const cloneCommand = `git clone --depth=1 "${remoteUrl}" "${targetPath}"`;

  exec(cloneCommand, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }
    res.json({ message: `Cloned ${repoName} successfully`, path: targetPath });
  });
});

app.listen(3001, () => console.log("ANAI backend running on port 3001"));
