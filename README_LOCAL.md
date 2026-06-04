# Royal Prussian - Setup Local com Ollama

🎉 **Sistema 100% local** - Discord Bot + Ollama + SQLite no seu computador

## ⚙️ Pré-requisitos

- **Node.js**: v18.0.0 ou superior ([download](https://nodejs.org/))
- **Ollama**: ([download](https://ollama.ai/)) - com modelo `qwen3.6:latest`
- **Windows/Mac/Linux**: compatível

## 📦 Instalação

### 1. Clonar e instalar dependências

```bash
cd Prussia
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DISCORD_TOKEN=seu_token_do_bot_aqui
CLIENT_ID=seu_client_id_do_bot_aqui

# Ollama (localhost)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.6:latest
```

**Como obter tokens Discord:**
1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação
3. Na aba "Bot", clique em "Add Bot"
4. Copie o token (copie com cuidado, não compartilhe!)
5. Em "OAuth2 > URL Generator", selecione escopos: `bot`
6. Selecione permissões necessárias
7. Use a URL gerada para convidar o bot ao seu servidor

## 🚀 Executar o Bot

### Opção 1: Modo desenvolvimento (simples)

```bash
npm start
```

### Opção 2: PM2 (recomendado para produção local)

#### Instalar PM2 globalmente

```bash
npm run pm2:install
```

#### Iniciar o bot com PM2

```bash
npm run pm2:start
```

#### Ver logs em tempo real

```bash
npm run pm2:logs
```

#### Gerenciar o bot

```bash
# Listar processos
npm run pm2:list

# Reiniciar
npm run pm2:restart

# Parar
npm run pm2:stop

# Salvar configuração (inicia automaticamente ao reiniciar PC)
npm run pm2:save

# Ativar inicialização automática ao reiniciar
npm run pm2:startup
```

## 🤖 Configurar Ollama

### 1. Instalar Ollama

- Acesse [ollama.ai](https://ollama.ai/)
- Baixe e instale para seu sistema operacional
- Abra o aplicativo

### 2. Baixar modelo qwen3.6:latest

```bash
ollama pull qwen3.6:latest
```

Isso pode levar alguns minutos (depende da velocidade de internet e modelo).

### 3. Verificar se Ollama está rodando

```bash
# Teste a conexão
curl http://localhost:11434/api/tags
```

Se retornar JSON com a lista de modelos, está funcionando! ✅

### 4. Manter Ollama rodando

Ollama precisa estar rodando para o bot funcionar. Opções:

**Opção A: Deixar aberto (simples)**
- Abra o aplicativo Ollama
- Deixe rodando enquanto o bot está ligado

**Opção B: Iniciar via terminal**
```bash
ollama serve
```

**Opção C: Iniciar em background (Windows)**
```bash
start "" ollama serve
```

## ✅ Verificar Configuração

Após iniciar o bot, verifique os logs:

```bash
# Procure por linhas como:
# [INFO] Conectando ao Ollama...
# ✅ Ollama online
# [INFO] Modelo encontrado: qwen3.6:latest
# 🚀 Royal Prussian pronta para servir
```

### Testar comando no Discord

No seu servidor Discord, execute:

```
/ollama-status
```

Se retornar informações do Ollama, está tudo funcionando! ✅

## 🔧 Solução de Problemas

### Erro: "Ollama está offline"

```
❌ Ollama está offline. Verifique: http://localhost:11434
```

**Solução:**
1. Abra o Ollama
2. Verifique se está na porta 11434
3. Reinicie o bot

### Erro: "Modelo não encontrado"

```
⚠️ Modelo não encontrado { model: 'qwen3.6:latest' }
```

**Solução:**
```bash
ollama pull qwen3.6:latest
```

### Erro: "Connection refused"

**Solução:**
1. Verifique se Ollama está rodando
2. Teste: `curl http://localhost:11434/api/tags`
3. Se não funcionar, reinicie Ollama

### Bot não responde a mensagens

**Verifique:**
1. Token Discord está correto em `.env`?
2. Bot tem permissão para enviar mensagens?
3. Ollama está online?
4. Verifique logs: `npm run pm2:logs` (se usando PM2)

## 📊 Monitorar Performance

### Com PM2

```bash
npm run pm2:list
```

Mostra:
- Status do processo
- Uptime
- Memória utilizada
- CPU

### Logs detalhados

```bash
# Últimas linhas
npm run pm2:logs -- --lines 50

# Seguir em tempo real
npm run pm2:logs
```

## 💾 Dados Persistentes

Todos os dados estão salvos localmente em SQLite:

- **Memória de usuários**: `data/memories.db` (criado automaticamente)
- **Conversas**: histórico de mensagens
- **Auditoria**: logs de ações administrativas

Nenhum dado é enviado para servidores externos.

## 🛠️ Variáveis de Ambiente Completas

```env
# Discord Bot
DISCORD_TOKEN=...         # Token do bot Discord
CLIENT_ID=...             # ID da aplicação Discord

# Ollama (localhost)
OLLAMA_URL=http://localhost:11434    # URL do Ollama
OLLAMA_MODEL=qwen3.6:latest          # Modelo a usar

# Logging
LOG_LEVEL=info            # debug, info, warn, error
```

## 📖 Comandos Disponíveis

### Slash Commands

- `/ping` - Responde com latência
- `/say [mensagem]` - Faz o bot falar
- `/ollama-status` - Status do Ollama
- `/help` - Ajuda
- `/admin` - Comandos administrativos (para staff)

### Tool Calling (Ações administrativas)

O bot pode executar:
- ✅ Enviar mensagens
- ✅ Criar anúncios
- ✅ Banir/expulsar usuários
- ✅ Timeout
- ✅ Limpar mensagens
- ✅ Trancar/destrancar canais
- ✅ Criar embeds

Sempre com verificação de permissões e logs de auditoria.

## 🔄 Reinicar Automaticamente

### Com PM2 (recomendado)

```bash
npm run pm2:startup
npm run pm2:save
```

Agora o bot inicia automaticamente quando o computador reinicia!

### Verificar status após reinicialização

```bash
npm run pm2:list
```

## 🚫 Parar tudo

```bash
# Parar bot (PM2)
npm run pm2:stop

# Parar Ollama
# Feche o aplicativo Ollama ou Ctrl+C no terminal
```

## 📝 Dicas de Performance

1. **RAM**: Deixe pelo menos 4GB livres para Ollama
2. **CPU**: Modelo qwen3.6 usa ~4 núcleos
3. **Resposta lenta?**: Reduz contexto em `src/config/config.js`
4. **Bot congelando?**: Aumenta timeout em `OLLAMA_URL` verificação

## 🆘 Suporte

Verifique:
1. Logs do bot: `npm run pm2:logs`
2. Status Ollama: `curl http://localhost:11434/api/tags`
3. Verificar `.env` está correto
4. Node.js versão: `node -v` (deve ser >=18)

## ✨ Próximos Passos

1. ✅ Instale Node.js, Ollama e dependências
2. ✅ Configure `.env` com tokens Discord
3. ✅ Puxe modelo: `ollama pull qwen3.6:latest`
4. ✅ Inicie: `npm start` ou `npm run pm2:start`
5. ✅ Teste no Discord: `/ollama-status`

Pronto para usar! 🎉
