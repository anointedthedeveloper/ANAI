@echo off
REM ANAI AI Agent IDE - Windows Installation & Launch Script
REM This script sets up and runs ANAI with Ollama integration

echo.
echo ========================================
echo   ANAI - AI Agent IDE Setup
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js %%i found
)

REM Check if Ollama is installed
echo [2/4] Checking Ollama...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Ollama not found!
    echo Please install Ollama from: https://ollama.ai/
    echo.
    echo After installing Ollama:
    echo 1. Open PowerShell and run: ollama pull mistral
    echo 2. Run: ollama serve
    echo 3. Then run this script again
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Ollama found
)

REM Install backend dependencies
echo [3/4] Installing dependencies...
cd backend
if not exist "node_modules" (
    call npm install >nul 2>&1
    echo ✅ Backend dependencies installed
) else (
    echo ✅ Backend dependencies already installed
)

REM Install frontend dependencies
cd ..\frontend
if not exist "node_modules" (
    call npm install >nul 2>&1
    echo ✅ Frontend dependencies installed
) else (
    echo ✅ Frontend dependencies already installed
)

REM Start the servers
echo [4/4] Starting ANAI servers...
echo.
echo ========================================
echo   Starting Backend Server...
echo ========================================
cd ..\backend
start cmd /k "node server.js"

timeout /t 2 /nobreak

echo.
echo ========================================
echo   Starting Frontend Server...
echo ========================================
cd ..\frontend
start cmd /k "npm start"

echo.
echo ========================================
echo   ANAI is starting!
echo ========================================
echo.
echo Frontend will open at: http://localhost:3000
echo Backend is running on: http://localhost:3001
echo Make sure Ollama is running: ollama serve
echo.
echo 💡 Tip: If Ollama isn't running, open PowerShell and run:
echo   ollama serve
echo.
echo Press any key to exit this window...
pause >nul

call npm install path-browserify

REM Download LLaMA 3 model
echo 🧠 Downloading LLaMA 3 model...
call ollama pull llama3

echo.
echo ✅ Installation complete!
echo.
echo 🚀 To start ANAI:
echo 1. Open 3 terminals
echo 2. Terminal 1: ollama serve
echo 3. Terminal 2: cd backend && node server.js
echo 4. Terminal 3: cd frontend && npm start
echo 5. Open http://localhost:3000 in your browser
echo.
echo 📚 For more info, see DEPLOYMENT.md
pause
