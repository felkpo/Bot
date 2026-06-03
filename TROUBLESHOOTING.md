# ❓ FAQ & Troubleshooting - Royal Prussian

## 🆘 Problemas Comuns

### Bot não inicia

**Erro: "Missing DISCORD_TOKEN"**
```
Solução:
1. Verifique se o arquivo .env existe
2. Verifique se contém: DISCORD_TOKEN=seu_token
3. Verifique se o token está correto
4. Tente reiniciar o bot
```

**Erro: "Cannot find module '@google/generative-ai'"**
```
Solução:
1. Execute: npm install
2. Aguarde a instalação completa
3. Verifique se node_modules existe
4. Se ainda não funcionar: rm -rf node_modules && npm install
```

**Erro: "ENOENT: no such file or directory"**
```
Solução:
1. Verifique se está no diretório correto: cd Prussia
2. Verifique se o arquivo index.js existe
3. Verifique estrutura de pastas em src/
```

### Bot não responde a mensagens

**Problema: Bot ativo mas não responde**
```
Verificar:
1. IA está habilitada em src/config/config.js?
   FEATURES.AI_ENABLED = true
2. Bot tem permissão "Read Message History"?
3. MessageContent intent está ativado?
4. Verifique os logs: npm start (observar console)
```

**Problema: Precisa de mention para responder**
```
Solução:
1. Verifique se prefixos estão corretos em config.js
2. Teste com: "RP tudo bem?" ou "@Royal Prussian tudo bem?"
3. Se funciona com @mention, problema está nos prefixos
4. Verifique regex.js para validação de prefixos
```

### Mensagens privadas (DM) não funcionam

**Problema: Bot responde em servidor mas não em DM**
```
Solução:
1. Seu servidor Discord pode ter bloqueado DMs de bots
2. O bot foi projetado para servidores principalmente
3. Verifique em Configurações → Privacidade
4. Se precisar, modifique messageCreate.js para permitir DMs
```

### Comando /addemoji falha

**Erro: "Não tenho permissão `Manage Emojis and Stickers`"**
```
Solução:
1. Dê ao bot a permissão "Manage Emojis and Stickers"
2. Ou defina como administrador
3. Verifique se a função tem permissão de gerenciar emojis
```

**Erro: "Arquivo muito grande"**
```
Solução:
1. Limite de arquivo é 256KB
2. Comprima a imagem antes de enviar
3. Use ferramentas online: https://tinypng.com
```

**Erro: "Limite de emojis atingido"**
```
Solução:
1. Seu servidor atingiu o limite de emojis
2. Tier 0: 50 emojis
3. Tier 1: 100 emojis
4. Tier 2: 150 emojis
5. Tier 3: 250 emojis
6. Remova emojis antigos ou aumente boosts do servidor
```

### IA não gera respostas

**Erro: "Erro ao conectar com IA Gemini"**
```
Solução:
1. Verifique GEMINI_API_KEY em .env
2. Verifique se a chave é válida em https://makersuite.google.com/app/apikey
3. Verifique se a API está ativada
4. Verifique limite de requisições (free tier: 60 req/min)
5. Aguarde alguns minutos se limite foi excedido
```

**Erro: "Chave de API Gemini inválida"**
```
Solução:
1. Gere uma nova chave em https://makersuite.google.com/app/apikey
2. Copie corretamente sem espaços extras
3. Atualize em .env
4. Reinicie o bot
```

**Erro: "Timeout ao conectar à API Gemini"**
```
Solução:
1. Verifique conexão de internet
2. Verifique se a API do Gemini está ativa
3. Verifique firewall/proxy
4. Aguarde alguns segundos e tente novamente
```

### Cooldown funciona incorretamente

**Problema: Muito rápido ou muito lento**
```
Solução:
Edite src/config/config.js:
AI: {
  cooldownMs: 2000,  // Altere este valor (em ms)
}
2000 = 2 segundos
5000 = 5 segundos
```

### Histórico de conversa não funciona

**Problema: Bot não lembra das mensagens anteriores**
```
Solução:
1. Histórico é por usuário, não por canal
2. Limite é 10 mensagens (configurável)
3. Se usar outro usuário, não terá histórico
4. Limite de tempo: conversas muito antigas são esquecidas
```

---

## ✅ Checklist de Configuração

### Antes de colocar em produção

- [ ] DISCORD_TOKEN está correto
- [ ] CLIENT_ID está correto
- [ ] GEMINI_API_KEY está correto
- [ ] Bot tem permissões necessárias
- [ ] Todos os prefixos estão configurados
- [ ] Testes de menção funcionam
- [ ] Testes de IA funcionam
- [ ] Cooldown está apropriado
- [ ] Logs estão funcionando
- [ ] Não há erros no console

### Permissões Mínimas

```
[✓] Send Messages
[✓] Read Messages/View Channels
[✓] Read Message History
[✓] Manage Emojis and Stickers
[✓] Manage Guild Expressions (alternativo para addemoji)
```

---

## 🔍 Como Debug

### Ativar Logs de Debug

Edite `.env`:
```
LOG_LEVEL=debug
```

Agora você verá muitas informações no console.

### Verificar se a IA está conectada

```
npm start

Procure por:
✅ IA Gemini conectada e funcionando
```

### Testar um comando específico

```
Use /ping para testar:
- Bot está respondendo
- Latência está boa
- Slash commands funcionam
```

### Ver histórico de um usuário

Modifique `src/ai/contextManager.js`, adicione no `getStats()`:

```javascript
// Adicione isto para debug
const contextManager = require('./src/ai/contextManager');
console.log(contextManager.getStats());
```

---

## 🚀 Otimizações

### Reduzir Consumo de API

```
// Em src/config/config.js
maxHistoryPerUser: 5,  // De 10 para 5
cooldownMs: 3000,      // De 2s para 3s
```

### Melhorar Performance

```
1. Aumente o cooldown
2. Diminua o máximo de histórico
3. Use um modelo Gemini mais rápido
4. Otimize as perguntas enviadas
```

---

## 📞 Suporte

### Verificação de Conexão

```bash
# Teste de internet
ping 8.8.8.8

# Teste de Discord API
curl https://discord.com/api/v10/

# Teste de Gemini API
# Verifique em https://makersuite.google.com/app/apikey
```

### Logs Importantes

Salve o output de:
```bash
npm start 2>&1 | tee bot.log
```

Procure por:
- `Error` - Erros críticos
- `ENOENT` - Arquivo não encontrado
- `ECONNREFUSED` - Conexão recusada
- `ETIMEDOUT` - Timeout

---

## 📊 Monitoramento

### Verificar Saúde do Bot

Envie `/ping` periodicamente e note:
- Latência aumentando = possível problema
- Sem resposta = bot offline
- Respostas lentas = overload

### Limite de API Gemini

```
Gemini Free Tier:
- 60 requisições/minuto
- Se exceder, aguarde depois tenta novamente
```

### Uso de Memória

```bash
# No Linux/Mac
node --max-old-space-size=512 index.js

# Aloca 512MB de memória (ajuste conforme necessário)
```

---

## 🆘 Relatório de Erro

Se o bot parar, reporte com:

1. Mensagem de erro do console (copie tudo)
2. Arquivo `.env` (sem os valores sensíveis)
3. Versão do Node.js: `node --version`
4. Sistema operacional
5. Passos para reproduzir o erro
6. Logs completos do bot

---

**Royal Prussian Support** 👑

Para mais ajuda, consulte:
- [Discord.js Docs](https://discord.js.org)
- [Gemini API Docs](https://ai.google.dev)
- [Node.js Docs](https://nodejs.org/docs)
