@echo off
echo ========================================
echo Digital Twin - Install Dependencies
echo ========================================
echo.
echo Installing npm packages...
echo This may take several minutes...
echo.

call npm install

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Installation failed!
    echo ========================================
    echo Please check:
    echo 1. You have Node.js installed
    echo 2. You have internet connection
    echo 3. You're in the correct directory
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS: All dependencies installed!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Run init-dataset.bat to process the data
    echo 2. Run start.bat to launch the application
    echo.
    pause
)