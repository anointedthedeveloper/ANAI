#!/bin/bash

# ANAI AI Agent IDE - macOS/Linux Installation & Launch Script
# This script sets up and runs ANAI with Ollama integration

echo ""
echo "========================================"
echo "  ANAI - AI Agent IDE Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
echo "[1/4] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js $(node --version) found"
fi

# Check if Ollama is installed
echo "[2/4] Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo ""
    echo "⚠️  Ollama not found!"
    echo "Please install Ollama from: https://ollama.ai/"
    echo ""
    echo "After installing Ollama:"
    echo "1. Open Terminal and run: ollama pull mistral"
    echo "2. Run: ollama serve"
    echo "3. Then run this script again"
    echo ""
    exit 1
else
    echo "✅ Ollama found"
fi

# Install backend dependencies
echo "[3/4] Installing dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install > /dev/null 2>&1
    echo "✅ Backend dependencies installed"
else
    echo "✅ Backend dependencies already installed"
fi

# Install frontend dependencies
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install > /dev/null 2>&1
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies already installed"
fi

# Start the servers
echo "[4/4] Starting ANAI servers..."
echo ""
echo "========================================"
echo "  Starting Backend Server..."
echo "========================================"

cd ../backend

# Start backend in background
node server.js &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait a moment for backend to start
sleep 2

echo ""
echo "========================================"
echo "  Starting Frontend Server..."
echo "========================================"

cd ../frontend

# Start frontend
npm start &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "========================================"
echo "  ANAI is starting!"
echo "========================================"
echo ""
echo "Frontend will open at: http://localhost:3000"
echo "Backend is running on: http://localhost:3001"
echo "Make sure Ollama is running: ollama serve"
echo ""
echo "💡 Tip: If Ollama isn't running, open Terminal and run:"
echo "   ollama serve"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for user interrupt
wait
