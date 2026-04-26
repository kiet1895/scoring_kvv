@echo off
echo Starting scoring_k backend...
cd /d "%~dp0backend"
if not exist venv (
    echo Creating virtualenv...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt -q
if not exist .env (
    copy .env.example .env
    echo Created .env from .env.example - please edit it to add your GEMINI_API_KEY
)
echo.
echo Backend running at http://localhost:8001
echo Docs at http://localhost:8001/docs
echo.
python main.py
