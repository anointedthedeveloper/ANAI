# ANAI - AI Agent IDE with Ollama Integration

A VS Code-like IDE with Monaco Editor integration and Ollama AI chatbot powered by local language models.

## Prerequisites

Make sure you have the following installed:
- **Node.js** (v16+) - [Download](https://nodejs.org/)
- **Ollama** - [Download](https://ollama.ai/)

## Setup Instructions

### 1. Install Ollama & Download Models

First, you need to have Ollama running with at least one model installed.

**Download and install Ollama:**
- Visit https://ollama.ai/
- Download for your OS (Windows, Mac, or Linux)
- Install and follow the setup wizard

**Download a language model:**
Open PowerShell/Terminal and run one of these commands:

```bash
# Fast & Light (Recommended for beginners)
ollama pull mistral

# Good for coding tasks
ollama pull neural-chat

# Powerful but slower
ollama pull llama2
```

**Start Ollama server:**
```bash
ollama serve
```

This will start Ollama on `http://localhost:11434` (this needs to be running for the app to work!)

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

## Running the Application

### Quick Start (Recommended)

**Option A: Using PowerShell (Windows)**

Open PowerShell and run:
```bash
./install.bat
```

This will:
- Start Ollama server (if installed)
- Install dependencies
- Start both backend and frontend

### Manual Start

**Terminal 1 - Start Backend:**
```bash
cd backend
node server.js
```
Expected output: `ANAI backend running on port 3001`

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm start
```
This will open the app at `http://localhost:3000`

## How to Use ANAI

### 1. **File Explorer (Left Sidebar)**
- Browse and open files in your project
- Click files to view them in the editor

### 2. **Code Editor (Center)**
- Full Monaco Editor with VS Code features:
  - Syntax highlighting
  - Code minimap
  - Bracket pair colorization
  - Auto-complete suggestions
  - Sticky scroll for functions

### 3. **AI Chat (Right Sidebar)**
- Click the **▶** button to expand the AI chat panel
- **Select your AI model** from the dropdown (Mistral, Llama2, Neural-Chat, etc.)
- **Ask questions** about your code or coding in general
- The AI can help with:
  - Code explanations
  - Debugging advice
  - Writing code snippets
  - Architecture suggestions

### 4. **Terminal (Bottom)**
- Run shell commands directly
- View command output
- Build and run your projects

## Example Prompts for the AI

```
"How do I reverse an array in JavaScript?"
"Explain this code block to me"
"What are the best practices for React hooks?"
"Help me debug this error: [paste error message]"
"Write a function that..."
"Optimize this algorithm"
```

## Troubleshooting

### "Connection refused" or "Ollama not running"
**Solution:** Make sure you have Ollama running:
```bash
ollama serve
```

### "No models available"
**Solution:** Download a model first:
```bash
ollama pull mistral
```

### Frontend won't start
**Solution:** Clear cache and reinstall:
```bash
cd frontend
rm -r node_modules package-lock.json
npm install
npm start
```

### Port 3001 already in use
**Solution:** Change the port in `backend/server.js` line 1 or kill the process using port 3001:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3001
kill <PID>
```

## Available AI Models in Ollama

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| mistral | 4.1GB | Fast | General purpose, coding |
| neural-chat | 4.1GB | Fast | Chat, helpfulness |
| llama2 | 3.8GB | Medium | Powerful, versatile |
| orca-mini | 1.3GB | Very Fast | Quick answers |
| dolphin-mixtral | 26GB | Slow | Advanced reasoning |

To download more: `ollama pull <model-name>`

## Architecture

```
ANAI/
├── frontend/                    # React app
│   ├── public/
│   ├── src/
│   │   ├── App.js              # Main IDE layout
│   │   ├── CodeEditor.js       # Monaco Editor wrapper
│   │   ├── AiChat.js           # AI Chat sidebar
│   │   └── App.css             # VS Code-like styling
│   └── package.json
│
├── backend/                     # Express server
│   ├── server.js               # Ollama integration & file API
│   └── package.json
│
├── DEPLOYMENT.md               # Deployment instructions
├── README.md                   # This file
└── install.bat                 # Quick start script
```

## Features

✅ **Monaco Editor** - VS Code's exact editor
✅ **Ollama Integration** - Use local AI models (no API keys!)
✅ **Multi-Model Support** - Switch between Mistral, Llama2, Neural-Chat, etc.
✅ **File Explorer** - Browse and open files
✅ **VS Code Theme** - Dark theme that matches VS Code perfectly
✅ **Terminal** - Run commands in the IDE
✅ **Code Syntax** - Supports 50+ languages
✅ **Sticky Scroll** - Keep function names visible while scrolling
✅ **Minimap** - Quick code overview on the right

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send AI message |
| `Ctrl+S` | Save file |
| `Ctrl+/` | Toggle comment |
| `Alt+↑/↓` | Move line up/down |
| `Ctrl+D` | Select word |

## Performance Tips

- **Use Mistral or Neural-Chat** for faster responses
- **Keep terminal output clear** to avoid lag
- **Close unnecessary files** to reduce memory usage
- **Use smaller models** if your computer has limited RAM

## Next Steps

1. Download a model: `ollama pull mistral`
2. Start Ollama: `ollama serve`
3. Run the app: `./install.bat` or follow manual instructions
4. Open `http://localhost:3000`
5. Start coding and chatting with ANAI!

## Support

For issues:
1. Check that Ollama is running on `http://localhost:11434`
2. Ensure a model is installed: `ollama list`
3. Check browser console for errors (F12)
4. Restart both frontend and backend

---

**Made with ❤️ for AI-powered coding**

Happy coding! 🚀
