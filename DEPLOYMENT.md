# ANAI Deployment Guide

## 🚀 Running ANAI on Another System

This guide will help you deploy ANAI AI Agent IDE on any system (Windows, macOS, Linux).

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10+, macOS 10.15+, or Ubuntu 18.04+
- **RAM**: 8GB minimum (16GB+ recommended for LLaMA 3)
- **Storage**: 10GB free space (5GB for LLaMA 3 model)
- **CPU**: 4+ cores (8+ recommended)
- **Network**: Internet connection for initial setup only

### Software Requirements
- **Node.js** v14 or higher
- **Git** (for cloning repository)
- **Ollama** (for local AI model serving)

## 🔧 Installation Steps

### Option 1: Quick Setup (Recommended)

#### Step 1: Clone Repository
```bash
git clone <your-repo-url>
cd anai
```

#### Step 2: Install Ollama
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

#### Step 3: Download AI Model
```bash
ollama pull llama3
```

#### Step 4: Install Dependencies
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
npm install path-browserify
```

#### Step 5: Start Application
```bash
# Start Ollama service (new terminal)
ollama serve

# Start backend (new terminal)
cd backend
node server.js

# Start frontend (new terminal)
cd frontend
npm start
```

### Option 2: Docker Deployment

#### Step 1: Create Dockerfile
Create `Dockerfile` in project root:
```dockerfile
FROM node:18

# Install Ollama
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Download model
RUN ollama pull llama3

# Copy application
COPY . /app
WORKDIR /app

# Install dependencies
RUN cd backend && npm install
RUN cd ../frontend && npm install && npm install path-browserify

# Expose ports
EXPOSE 3000 3001 11434

# Start services
CMD ["sh", "-c", "ollama serve & cd backend && node server.js & cd ../frontend && npm start"]
```

#### Step 2: Build and Run
```bash
docker build -t anai-ide .
docker run -p 3000:3000 -p 3001:3001 -p 11434:11434 anai-ide
```

## 🌐 Accessing the Application

After installation:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Ollama API**: http://localhost:11434

## 🔧 Configuration

### Environment Variables
Create `.env` file in backend directory:
```env
OLLAMA_URL=http://localhost:11434/api/generate
MODEL_NAME=llama3
PORT=3001
```

### Port Configuration
If ports are occupied, modify in:
- **Backend**: `backend/server.js` (change port 3001)
- **Frontend**: `frontend/package.json` (change port 3000)
- **Ollama**: Environment variable `OLLAMA_HOST=0.0.0.0:11434`

## 📱 Platform-Specific Notes

### Windows
- Use PowerShell or Command Prompt
- Install Windows Terminal for better experience
- Ensure Windows Defender allows Node.js and Ollama

### macOS
- Use Terminal.app or iTerm2
- Install Xcode Command Line Tools if needed
- Allow Ollama in Security & Privacy settings

### Linux
- Use apt, yum, or dnf for Node.js if not installed
- Ensure proper permissions for Ollama
- Consider using systemd for service management

## 🚀 Production Deployment

### Option 1: PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start server.js --name "anai-backend"

# Start frontend with PM2
cd ../frontend
pm2 start npm --name "anai-frontend" -- start
```

### Option 2: Systemd Service (Linux)
Create `/etc/systemd/system/anai.service`:
```ini
[Unit]
Description=ANAI IDE Backend
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/anai/backend
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable anai
sudo systemctl start anai
```

### Option 3: Cloud Deployment
**AWS EC2:**
- Choose t3.large or better instance
- Open ports 3000, 3001, 11434
- Follow standard installation steps

**DigitalOcean:**
- Use 4GB+ RAM droplet
- Configure firewall for required ports
- Install Docker for easier management

## 🔍 Troubleshooting

### Common Issues

**Ollama not found:**
```bash
# Check if installed
which ollama

# Restart shell or reinstall
curl -fsSL https://ollama.ai/install.sh | sh
```

**Port conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
netstat -tulpn | grep :11434

# Kill processes
sudo kill -9 <PID>
```

**Memory issues:**
- Close other applications
- Use smaller model: `ollama pull llama3:8b`
- Increase swap space on Linux

**Network issues:**
- Check firewall settings
- Verify port forwarding
- Use `0.0.0.0` instead of localhost

### Performance Optimization

**For better performance:**
1. Use SSD storage
2. Increase RAM if possible
3. Use GPU acceleration (if available)
4. Optimize model size:
   ```bash
   ollama pull llama3:8b  # Smaller, faster
   ollama pull llama3:70b  # Larger, smarter
   ```

## 📚 Additional Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Node.js Deployment Guide](https://nodejs.org/en/docs/guides/deployment/)
- [React Production Build](https://reactjs.org/docs/production-build)

## 🤝 Support

For deployment issues:
1. Check system requirements
2. Verify all services are running
3. Check logs for error messages
4. Test each component individually

---

**ANAI** - Your AI-powered development environment, anywhere you need it.
