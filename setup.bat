@echo off
echo ========================================
echo Digital Twin Consumer Response Tester
echo Setup and Launch Script
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    echo This may take a few minutes...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies
        echo Please check your internet connection and try again
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
) else (
    echo Dependencies already installed.
    echo.
)

REM Check if dataset has been initialized
if not exist "data\datasets\surf-clothing\processed\processed_data.json" (
    echo Initializing surf-clothing dataset...
    echo This will process the survey data and PDFs...
    call npm run init-dataset surf-clothing
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to initialize dataset
        echo Please check the error messages above
        pause
        exit /b 1
    )
    echo Dataset initialized successfully!
    echo.
) else (
    echo Dataset already initialized.
    echo.
)

echo ========================================
echo Starting Digital Twin Server...
echo ========================================
echo.
echo Server will start at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the server
call npm run dev