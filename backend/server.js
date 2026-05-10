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

// Memory system to store conversation history
let history = [];

// Simple agent system
app.post("/ask", async (req, res) => {
  const userPrompt = req.body.prompt;

  const systemPrompt = `
You are ANAI, a coding AI agent.

TOOLS:
- READ_FILE: filename
- WRITE_FILE: filename | content
- RUN: command

If you need a tool, respond ONLY in that format.
Otherwise, answer normally.
`;

  // Add user message to history
  history.push({ role: "user", content: userPrompt });
  
  // Keep only last 10 messages to avoid context overflow
  if (history.length > 10) {
    history = history.slice(-10);
  }

  // Build conversation context
  const conversationContext = history.map(msg => `${msg.role}: ${msg.content}`).join("\n");

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: "llama3",
      prompt: systemPrompt + "\n" + conversationContext + "\nAssistant:",
      stream: false
    });

    let output = response.data.response;
    
    // Add AI response to history
    history.push({ role: "assistant", content: output });

    // Tool handling
    if (output.startsWith("READ_FILE:")) {
      const file = output.replace("READ_FILE:", "").trim();
      const content = fs.existsSync(file)
        ? fs.readFileSync(file, "utf-8")
        : "File not found";

      return res.json({ tool: "read", file, content });
    }

    if (output.startsWith("WRITE_FILE:")) {
      const parts = output.replace("WRITE_FILE:", "").split("|");
      const file = parts[0].trim();
      const content = parts[1].trim();

      // Ensure directory exists
      const dir = file.substring(0, file.lastIndexOf("/"));
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(file, content);
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

// Clear history endpoint
app.post("/clear", (req, res) => {
  history = [];
  res.json({ message: "History cleared" });
});

// Get history endpoint
app.get("/history", (req, res) => {
  res.json({ history });
});

// File system endpoints
const getDirectoryTree = (dirPath, relativePath = "") => {
  try {
    const items = fs.readdirSync(dirPath);
    const result = [];
    
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      const itemRelativePath = path.join(relativePath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules and .git folders
        if (item === 'node_modules' || item === '.git') return;
        
        result.push({
          name: item,
          type: 'folder',
          path: itemRelativePath,
          children: getDirectoryTree(itemPath, itemRelativePath)
        });
      } else {
        result.push({
          name: item,
          type: 'file',
          path: itemRelativePath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    });
    
    return result.sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

// List files in directory
app.get("/files", (req, res) => {
  const dirPath = req.query.path || process.cwd();
  try {
    const tree = getDirectoryTree(dirPath);
    res.json({ tree, currentPath: dirPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
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

// Write file content
app.post("/file", (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: "File path and content are required" });
  }
  
  try {
    // Ensure directory exists
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

app.listen(3001, () => console.log("ANAI backend running on port 3001"));
