# 🔄 Mudança de Setup: Railway → Local

## O que mudou

Este projeto foi migrado de hospedagem em **Railway** (nuvem) para **execução local** no seu computador.

### Antes (Railway + Gemini/Ollama remoto)
```
┌─────────────────────┐
│   Seu Computador    │
│   Discord Bot       │
└─────────────┬───────┘
              │
              ▼
        ┌─────────────┐
        │   Railway   │
        │   (Nuvem)   │
        │ Ngrok/CF    │
        └─────┬───────┘
              │
              ▼
      ┌────────────────┐
      │    Ollama      │
      │   (Remoto)     │
      └────────────────┘
```

### Agora (100% Local)
```
┌──────────────────────────┐
│   Seu Computador         │
│                          │
│  ┌──────────────────┐   │
│  │  Discord Bot     │◄──┼─ Port 3000
│  │  (Node.js)       │   │
│  └────────┬─────────┘   │
│           │             │
│  ┌────────▼─────────┐   │
│  │     Ollama       │   │
│  │  (localhost)     │   │
│  │  qwen3.6:latest  │   │
│  └──────────────────┘   │
│                          │
│  ┌──────────────────┐   │
│  │  SQLite (local)  │   │
│  │  memories.db     │   │
│  └──────────────────┘   │
└──────────────────────────┘
```

## Benefícios

✅ **Privacidade total** - nenhum dado deixa seu computador
✅ **Sem custos** - nenhuma hospedagem paga
✅ **Sem latência** - tudo rodando localmente
✅ **Controle total** - você decide tudo
✅ **Offline** - funciona sem internet (após inicializar)
✅ **PM2** - reinicia automaticamente se travar

## Arquivos Removidos

- ❌ `railway.json` - Deletado
- ❌ `README_DEPLOY.md` - Supercedido por `README_LOCAL.md`
- ❌ `start:railway` script - Removido de `package.json`

## Arquivos Novos/Atualizados

- ✅ `README_LOCAL.md` - Guia completo de setup local
- ✅ `.env.example` - Atualizado (Gemini → Ollama)
- ✅ `package.json` - Adicionados scripts PM2
- ✅ `src/config/config.js` - Defaults para localhost
- ✅ `src/ai/ollama.js` - Melhorado (healthCheck, model verification)

## Como Migrar

1. **Copie `.env.example` para `.env`**
   ```bash
   cp .env.example .env
   ```

2. **Configure seus tokens Discord em `.env`**

3. **Instale e configure Ollama:**
   ```bash
   # Baixe em https://ollama.ai/
   ollama pull qwen3.6:latest
   ```

4. **Inicie tudo:**
   ```bash
   # Terminal 1: Ollama
   ollama serve

   # Terminal 2: Bot
   npm start
   # Ou com PM2: npm run pm2:start
   ```

5. **Verifique logs:**
   ```bash
   npm run pm2:logs
   ```

## Scripts Úteis (PM2)

```bash
npm run pm2:start      # Iniciar
npm run pm2:stop       # Parar
npm run pm2:restart    # Reiniciar
npm run pm2:logs       # Ver logs
npm run pm2:list       # Status
npm run pm2:save       # Salvar (inicia ao reiniciar PC)
npm run pm2:startup    # Ativar auto-start no boot
```

## Troubleshooting

| Erro | Solução |
|------|---------|
| "Ollama está offline" | Inicie Ollama: `ollama serve` |
| "Modelo não encontrado" | `ollama pull qwen3.6:latest` |
| "Connection refused" | Verifique se Ollama está em `localhost:11434` |
| Bot não responde | Verifique `.env`, tokens e logs |

## Próximos Passos

→ Leia **[README_LOCAL.md](README_LOCAL.md)** para instruções detalhadas

---

**Tudo pronto para rodar 100% localmente! 🚀**
