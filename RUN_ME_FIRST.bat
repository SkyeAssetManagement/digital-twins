@echo off
color 0A
echo ========================================
echo    DIGITAL TWIN CONSUMER TESTER
echo    Complete Setup & Launch
echo ========================================
echo.
echo This script will:
echo [1] Install all dependencies
echo [2] Initialize the dataset
echo [3] Start the server
echo [4] Open your browser
echo.
echo Press any key to begin setup...
pause >nul

echo.
echo ========================================
echo STEP 1: Installing Dependencies
echo ========================================
call npm install
if errorlevel 1 goto error

echo.
echo ========================================
echo STEP 2: Initializing Dataset
echo ========================================
if not exist "data\datasets\surf-clothing\processed\processed_data.json" (
    call npm run init-dataset surf-clothing
    if errorlevel 1 goto error
) else (
    echo Dataset already initialized - skipping
)

echo.
echo ========================================
echo STEP 3: Starting Server
echo ========================================
echo.
echo Opening browser to http://localhost:3000
start http://localhost:3000

echo.
echo Server starting...
echo Press Ctrl+C to stop the server when done
echo.
call npm run dev
goto end

:error
color 0C
echo.
echo ========================================
echo ERROR: Setup failed!
echo ========================================
echo Please check the error messages above
echo.
echo Common issues:
echo - Node.js not installed
echo - No internet connection
echo - Database not configured in .env.local
echo.
pause
goto end

:end