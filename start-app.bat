@echo off
title Western India Plywoods - Boiler Fuel Management
echo ========================================================
echo   WESTERN INDIA PLYWOODS - BOILER FUEL MANAGEMENT APP
echo ========================================================
echo.
echo Starting local application server...
echo.

where agy-node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start http://localhost:3000
    agy-node server.js
) else (
    echo Opening application directly in your default browser...
    start index.html
)
pause
