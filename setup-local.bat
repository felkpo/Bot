@echo off
REM Setup rápido para Royal Prussian (Local + Ollama + PM2)
REM Windows batch script

echo.
echo ===================================================
echo   Royal Prussian - Setup Local
echo ===================================================
echo.

REM Verificar Node.js
echo [1/5] Verificando Node.js...
node -v > nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado!
    echo   Baixe em: https://nodejs.org/
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION%
echo.

REM Instalar dependências
echo [2/5] Instalando dependências npm...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo ❌ Falha ao instalar dependências
    exit /b 1
)
echo ✅ Dependências instaladas
echo.

REM Verificar Ollama
echo [3/5] Verificando Ollama em http://localhost:11434...
powershell -Command "$null = try { Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -Method GET -ErrorAction Stop } catch { exit 1 }" > nul 2>&1
if errorlevel 1 (
    echo ⚠️  Ollama não encontrado em localhost:11434
    echo    Abra Ollama ou execute: ollama serve
    echo    Aguardando 5 segundos...
    timeout /t 5 /nobreak
) else (
    echo ✅ Ollama está rodando
)
echo.

REM Verificar .env
echo [4/5] Verificando configuração .env...
if not exist ".env" (
    echo ⚠️  Arquivo .env não encontrado
    echo    Copiando .env.example para .env
    copy ".env.example" ".env"
    echo ⚠️  Edite .env com seus tokens Discord
    echo    Tokens necessários:
    echo    - DISCORD_TOKEN
    echo    - CLIENT_ID
    pause
) else (
    echo ✅ Arquivo .env encontrado
)
echo.

REM Iniciar bot
echo [5/5] Iniciando bot...
echo.
echo Opções:
echo   1 - Iniciar normalmente (npm start)
echo   2 - Iniciar com PM2 (npm run pm2:start)
echo.

set /p CHOICE="Escolha uma opção (1 ou 2): "

if "%CHOICE%"=="1" (
    echo.
    echo Iniciando bot...
    call npm start
) else if "%CHOICE%"=="2" (
    echo.
    echo Instalando PM2...
    call npm run pm2:install
    echo.
    echo Iniciando bot com PM2...
    call npm run pm2:start
    echo.
    echo ✅ Bot iniciado com PM2!
    echo   Ver logs: npm run pm2:logs
    echo   Parar: npm run pm2:stop
) else (
    echo ❌ Opção inválida
    exit /b 1
)
