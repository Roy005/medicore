@echo off
echo Starting MediCore Development Environment...

echo [1/4] Starting PostgreSQL and Redis via Docker...
docker-compose up -d postgres redis

echo [2/4] Installing Backend dependencies...
cd apps\backend
call "C:\Program Files\nodejs\npm.cmd" install
echo Starting Backend...
start "MediCore Backend" cmd /k ""C:\Program Files\nodejs\npm.cmd" run start:dev"
cd ..\..

echo [3/4] Installing Frontend dependencies...
cd apps\frontend
call "C:\Program Files\nodejs\npm.cmd" install
echo Starting Frontend...
start "MediCore Frontend" cmd /k ""C:\Program Files\nodejs\npm.cmd" run dev"
cd ..\..

echo [4/4] Starting AI Service...
cd apps\ai-service
start "MediCore AI Service" cmd /k ".\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8001 --reload"
cd ..\..

echo All services have been launched in separate terminal windows!
pause
