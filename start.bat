@echo off
REM 🚀 Quick Start Script para Royal Prussian (Windows)

echo.
echo 👑 Royal Prussian - Setup Rapido
echo ==================================
echo.

REM Verifica Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js nao encontrado!
    echo 📥 Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% encontrado
echo.

REM Instala dependencias
echo 📦 Instalando dependencias...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependencias
    pause
    exit /b 1
)

echo ✅ Dependencias instaladas
echo.

REM Verifica .env
if not exist ".env" (
    echo ⚠️  Arquivo .env nao encontrado!
    echo 📋 Criando .env a partir do exemplo...
    copy .env.example .env
    echo.
    echo ⚠️  IMPORTANTE: Edite o arquivo .env com suas credenciais:
    echo    - DISCORD_TOKEN: Token do bot Discord
    echo    - CLIENT_ID: ID da aplicacao Discord
    echo    - GEMINI_API_KEY: Chave de API do Google Gemini
    echo.
    echo 📖 Consulte README.md para instrucoes detalhadas
    pause
    exit /b 1
)

echo ✅ Arquivo .env encontrado
echo.

REM Verifica conteudo do .env (simplificado para Windows)
findstr /M "seu_token_discord_aqui" .env >nul
if %errorlevel% equ 0 (
    echo ❌ DISCORD_TOKEN ainda nao configurada!
    echo 📋 Edite o arquivo .env
    pause
    exit /b 1
)

echo ✅ Configuracao validada
echo.
echo 🚀 Iniciando Royal Prussian...
echo.

call npm start
pause
