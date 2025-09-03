@echo off
echo ========================================
echo Digital Twin - Initialize Dataset
echo ========================================
echo.
echo This will process the surf-clothing dataset:
echo - Process Excel survey data
echo - Extract insights from PDF research files
echo - Discover consumer segments
echo - Generate digital twins
echo - Store in database
echo.
echo This may take a few minutes...
echo.

call npm run init-dataset surf-clothing

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Dataset initialization failed!
    echo ========================================
    echo Please check:
    echo 1. Database connection in .env.local
    echo 2. Data files exist in data\datasets\surf-clothing\raw\
    echo 3. Error messages above
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS: Dataset initialized!
    echo ========================================
    echo.
    echo You can now run start.bat to launch the application
    echo.
    pause
)