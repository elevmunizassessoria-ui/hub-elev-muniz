@echo off
chcp 65001 >nul
title Hub Elev Muniz
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e abra de novo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando o sistema pela primeira vez...
  call npm install --no-audit
)

if not exist "web\dist\index.html" (
  echo Preparando a tela...
  call npm run build
)

rem A porta vem do arquivo .env (PORT=80). Sem ele, 3180.
set PORTA=3180
if exist ".env" for /f "tokens=1,2 delims== " %%a in (.env) do if /i "%%a"=="PORT" set PORTA=%%b
if "%PORTA%"=="80" (start "" "http://localhost") else (start "" "http://localhost:%PORTA%")
echo.
echo Deixe esta janela aberta enquanto usa o sistema. Para desligar, feche-a.
node --env-file-if-exists=.env server\index.js
pause
