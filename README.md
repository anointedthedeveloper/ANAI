# ANAI - AI Agent IDE

A local, web-based AI-powered development environment that runs completely offline. ANAI provides a VS Code-like interface with an integrated AI assistant powered by local LLaMA models through Ollama.

## 🌟 Features

- **VS Code-Style Interface**: Professional dark theme with familiar layout
- **File Explorer**: Real-time file tree navigation with folder expansion
- **Code Editor**: Multi-tab editing with syntax highlighting
- **Integrated Terminal**: Command execution with history and navigation
- **AI Assistant**: Local AI chat powered by LLaMA 3
- **File Operations**: Read, write, and manage files through AI commands
- **Offline Operation**: Works completely offline without internet connection
- **Real-time Collaboration**: AI can execute commands and modify files

## 🏗️ Architecture

```
Browser (React UI)
        ↓
Node.js Backend (Agent Logic)
        ↓
Ollama API (localhost:11434)
        ↓
LLaMA 3 Model
```

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **Ollama** (for local AI models)
- **Windows/macOS/Linux** system

## 🚀 Quick Start

### 1. Install Ollama

**Windows:**
```bash
winget install Ollama.Ollama
```

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Download LLaMA 3 Model

```bash
ollama pull llama3
```

### 3. Clone and Setup ANAI

```bash
git clone <your-repo-url>
cd anai
```

### 4. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
npm install path-browserify
```

### 5. Start the Application

**Start Ollama Service:**
```bash
ollama serve
```

**Start Backend:**
```bash
cd backend
node server.js
```

**Start Frontend:**
```bash
cd frontend
npm start
```

### 6. Access ANAI

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🎯 Usage Guide

### File Management
- **Browse Files**: Use the file explorer in the left sidebar
- **Open Files**: Click on any file to open it in the editor
- **Multiple Tabs**: Open multiple files simultaneously
- **Save Files**: Use the Save button or Ctrl+S

### Terminal
- **Execute Commands**: Type directly in the terminal
- **Command History**: Use ↑/↓ arrows to navigate history
- **Clear Terminal**: Type `clear` to clear the terminal
- **View History**: Type `history` to see all previous commands

### AI Assistant
- **Ask Questions**: Type in the chat input to ask ANAI anything
- **File Operations**: ANAI can read and write files using commands like:
  - `READ_FILE: filename.js`
  - `WRITE_FILE: filename.js | your code here`
  - `RUN: npm install`
- **Code Generation**: Ask ANAI to generate code snippets or full files
- **Debugging**: Get help with errors and debugging

### AI Tools
ANAI has access to these tools:
- **READ_FILE**: Read file contents
- **WRITE_FILE**: Write or modify files
- **RUN**: Execute terminal commands

## 📁 Project Structure

```
anai/
├── backend/
│   ├── node_modules/
│   ├── package.json
│   └── server.js          # Express server with AI logic
├── frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   └── App.css        # VS Code-style CSS
│   └── package.json
├── .gitignore
└── README.md
```

## 🔧 Configuration

### Backend Configuration
Edit `backend/server.js` to modify:
- Ollama API URL
- Model selection
- Port settings
- AI system prompts

### Frontend Configuration
Edit `frontend/src/App.js` to modify:
- API endpoints
- UI themes
- Default settings

## 🤝 AI Capabilities

ANAI can help you with:
- **Code Generation**: Generate functions, classes, and complete files
- **Debugging**: Analyze errors and suggest fixes
- **Refactoring**: Improve code structure and performance
- **Documentation**: Generate comments and documentation
- **Testing**: Create unit tests and integration tests
- **File Management**: Organize and manage project files
- **Command Execution**: Run build scripts, tests, and deployment commands

## 🛠️ Development

### Adding New Features
1. **Backend**: Add new API endpoints in `server.js`
2. **Frontend**: Create React components in `frontend/src/`
3. **Styling**: Modify `App.css` for UI changes

### AI Tool Extensions
Extend AI capabilities by adding new tools in the backend:
```javascript
if (output.startsWith("YOUR_TOOL:")) {
  // Handle your custom tool
  const params = output.replace("YOUR_TOOL:", "").trim();
  // Process and return response
}
```

## 🔍 Troubleshooting

### Common Issues

**Ollama not found:**
- Ensure Ollama is installed and in system PATH
- Restart terminal after installation
- Check if Ollama service is running

**Port conflicts:**
- Change ports in `backend/server.js`
- Ensure ports 3000 and 3001 are available

**Frontend build errors:**
- Run `npm install` in frontend directory
- Install `path-browserify` package
- Clear browser cache

**AI not responding:**
- Check if Ollama service is running
- Verify LLaMA 3 model is downloaded
- Check backend console for errors

### Getting Help
- Check the console for error messages
- Verify all services are running
- Ensure proper network connectivity to localhost

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🌟 Acknowledgments

- **Ollama** for providing local AI model serving
- **LLaMA 3** by Meta for the powerful AI model
- **React** for the frontend framework
- **Express.js** for the backend framework
- **VS Code** for the inspiration behind the interface design

## 🚀 Quick Deployment

### One-Command Installation

**Linux/macOS:**
```bash
curl -sSL https://raw.githubusercontent.com/your-repo/anai/main/install.sh | bash
```

**Windows:**
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-repo/anai/main/install.bat" -OutFile "install.bat" | ./install.bat
```

### Manual Setup
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions for all platforms.

---

**ANAI** - Your local AI-powered development companion. Build, code, and create with the help of AI, all while keeping your data private and secure.
