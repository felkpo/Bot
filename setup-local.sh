#!/bin/bash
# Setup rápido para Royal Prussian (Local + Ollama + PM2)
# Linux/Mac shell script

set -e

echo ""
echo "==================================================="
echo "  Royal Prussian - Setup Local"
echo "==================================================="
echo ""

# Verificar Node.js
echo "[1/5] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "   Baixe em: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "✅ $NODE_VERSION"
echo ""

# Instalar dependências
echo "[2/5] Instalando dependências npm..."
npm install --no-audit --no-fund
echo "✅ Dependências instaladas"
echo ""

# Verificar Ollama
echo "[3/5] Verificando Ollama em http://localhost:11434..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama está rodando"
else
    echo "⚠️  Ollama não encontrado em localhost:11434"
    echo "   Abra Ollama ou execute: ollama serve"
    echo "   Aguardando 5 segundos..."
    sleep 5
fi
echo ""

# Verificar .env
echo "[4/5] Verificando configuração .env..."
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado"
    echo "   Copiando .env.example para .env"
    cp ".env.example" ".env"
    echo "⚠️  Edite .env com seus tokens Discord"
    echo "   Tokens necessários:"
    echo "   - DISCORD_TOKEN"
    echo "   - CLIENT_ID"
    read -p "Pressione Enter para continuar..."
else
    echo "✅ Arquivo .env encontrado"
fi
echo ""

# Iniciar bot
echo "[5/5] Iniciando bot..."
echo ""
echo "Opções:"
echo "  1 - Iniciar normalmente (npm start)"
echo "  2 - Iniciar com PM2 (npm run pm2:start)"
echo ""

read -p "Escolha uma opção (1 ou 2): " CHOICE

if [ "$CHOICE" = "1" ]; then
    echo ""
    echo "Iniciando bot..."
    npm start
elif [ "$CHOICE" = "2" ]; then
    echo ""
    echo "Instalando PM2..."
    npm run pm2:install
    echo ""
    echo "Iniciando bot com PM2..."
    npm run pm2:start
    echo ""
    echo "✅ Bot iniciado com PM2!"
    echo "   Ver logs: npm run pm2:logs"
    echo "   Parar: npm run pm2:stop"
else
    echo "❌ Opção inválida"
    exit 1
fi
