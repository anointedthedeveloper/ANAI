const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = "http://localhost:11434/api/generate";
const REPO_BASE = path.resolve(process.cwd(), "repos");
if (!fs.existsSync(REPO_BASE)) {
  fs.mkdirSync(REPO_BASE, { recursive: true });
}

let history = [];

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
  const dirPath = req.query.path || process.cwd();
  try {
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

app.get("/models", async (req, res) => {
  try {
    const response = await axios.get("http://localhost:11434/api/tags");
    res.json(response.data);
  } catch (error) {
    res.json({
      models: [
        { name: "llama2" },
        { name: "mistral" },
        { name: "neural-chat" }
      ]
    });
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
