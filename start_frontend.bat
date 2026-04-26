@echo off
echo Starting scoring_k frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Installing npm packages...
    npm install
)
echo.
echo Frontend running at http://localhost:5173
echo.
npm run dev
