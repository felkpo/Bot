#!/usr/bin/env bash
# 🚀 Quick Start Script para Royal Prussian

echo "👑 Royal Prussian - Setup Rápido"
echo "=================================="
echo ""

# Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "📥 Baixe em: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"
echo ""

# Instala dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo "✅ Dependências instaladas"
echo ""

# Verifica .env
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado!"
    echo "📋 Criando .env a partir do exemplo..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANTE: Edite o arquivo .env com suas credenciais:"
    echo "   - DISCORD_TOKEN: Token do bot Discord"
    echo "   - CLIENT_ID: ID da aplicação Discord"
    echo "   - GEMINI_API_KEY: Chave de API do Google Gemini"
    echo ""
    echo "📖 Consulte README.md para instruções detalhadas"
    exit 1
fi

echo "✅ Arquivo .env encontrado"
echo ""

# Verifica variáveis
if grep -q "seu_token_discord_aqui" .env; then
    echo "❌ DISCORD_TOKEN ainda não configurada!"
    echo "📋 Edite o arquivo .env"
    exit 1
fi

if grep -q "sua_chave_api_gemini_aqui" .env; then
    echo "⚠️  GEMINI_API_KEY não está configurada"
    echo "   O bot funcionará sem IA"
    echo ""
fi

echo "✅ Configuração validada"
echo ""
echo "🚀 Iniciando Royal Prussian..."
echo ""
npm start
