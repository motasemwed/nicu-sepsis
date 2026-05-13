@echo off
echo ====================================
echo   NeoGuard AI - Backend Setup
echo ====================================
echo.

SET PYTHON="C:\Users\96277\nicu-sepsis\.venv\Scripts\python.exe"

echo Checking Python in venv...
%PYTHON% --version
IF ERRORLEVEL 1 (
    echo [ERROR] Could not find Python 3.10 in .venv folder.
    pause
    exit /b
)

echo.
echo Bootstrapping pip (first time only)...
%PYTHON% -m ensurepip --upgrade

echo.
echo Installing required packages (please wait, may take 3-5 minutes)...
echo.
%PYTHON% -m pip install fastapi "uvicorn[standard]" python-multipart torch pandas numpy scipy scikit-learn joblib

echo.
echo ====================================
echo   Starting NeoGuard API Server...
echo   Open browser: http://127.0.0.1:8000/health
echo ====================================
echo.

cd /d "C:\Users\96277\nicu-sepsis"
%PYTHON% -m uvicorn backend.main:app --reload --port 8000

pause
