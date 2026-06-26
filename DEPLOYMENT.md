# 🚀 DEPLOYMENT & OTIMIZAÇÃO - Tenkai

## 📋 Checklist Pré-Produção

### Configuração
- [ ] `.env` configurado corretamente
- [ ] `DISCORD_TOKEN` válido
- [ ] `CLIENT_ID` correto
- [ ] `GEMINI_API_KEY` ativo
- [ ] Nenhum arquivo sensível no git

### Testes
- [ ] `/ping` funciona
- [ ] `/help` mostra todos os comandos
- [ ] Menção do bot responde
- [ ] Todos os prefixos funcionam
- [ ] IA responde de forma coerente
- [ ] Cooldown funciona
- [ ] Comandos admin funcionam
- [ ] Logs aparecem normalmente

### Performance
- [ ] Bot inicia em menos de 5s
- [ ] Responde em menos de 3s
- [ ] Não consome >200MB RAM
- [ ] Não há memory leaks

### Segurança
- [ ] Validação de entrada ativa
- [ ] Permissões verificadas
- [ ] Erros não expõem dados sensíveis
- [ ] Rate limiting ativo

---

## 🌐 Deployments Suportados

### Railway

1. **Conecte seu repositório GitHub**
   ```
   https://railway.app
   ```

2. **Variáveis de ambiente**
   - Adicione em "Variables":
     - `DISCORD_TOKEN`
     - `CLIENT_ID`
     - `GEMINI_API_KEY`
     - `LOG_LEVEL=info`

3. **Start command**
   ```
   npm start
   ```

4. **Deploy automático**
   - Railway faz deploy a cada push

### Heroku (Deprecated mas funciona)

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Crie app**
   ```bash
   heroku create seu-bot-name
   ```

3. **Configure variáveis**
   ```bash
   heroku config:set DISCORD_TOKEN=seu_token
   heroku config:set CLIENT_ID=seu_id
   heroku config:set GEMINI_API_KEY=sua_chave
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

### VPS (Linux)

1. **SSH no servidor**
   ```bash
   ssh usuario@seu_vps
   ```

2. **Clone repositório**
   ```bash
   git clone https://seu-repo.git
   cd Tenkai
   ```

3. **Instale Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Instale dependências**
   ```bash
   npm install
   ```

5. **Configure .env**
   ```bash
   nano .env
   # [Configure credenciais]
   ```

6. **Inicie com PM2**
   ```bash
   npm install -g pm2
   pm2 start index.js --name "tenkai"
   pm2 save
   pm2 startup
   ```

7. **Logs**
   ```bash
   pm2 logs tenkai
   ```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY index.js .
COPY .env .

CMD ["npm", "start"]
```

**Build e run:**
```bash
docker build -t tenkai .
docker run -d --name bot tenkai
```

---

## ⚡ Otimizações

### 1. Reduzir Uso de Memória

**Antes:**
```javascript
maxHistoryPerUser: 10,
cooldownMs: 2000,
```

**Depois:**
```javascript
maxHistoryPerUser: 5,
cooldownMs: 3000,
```

**Economia:** ~30-40% de RAM

### 2. Usar Cache

```javascript
// Em contextManager.js
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

if (cache.has(key)) {
  return cache.get(key);
}
```

### 3. Batch de Requisições

```javascript
// Agrupe requisições à API
const batch = [];

// Processa depois em lote
if (batch.length > 10) {
  await processBatch(batch);
}
```

### 4. Compressão de Logs

```javascript
// Rotacione logs antigos
const fs = require('fs');
const logSize = fs.statSync('./bot.log').size;

if (logSize > 10 * 1024 * 1024) { // 10MB
  // Comprima e mude de arquivo
}
```

---

## 📊 Monitoramento

### PM2 Dashboard

```bash
# Instale PM2+
pm2 install pm2-auto-pull

# Dashboard
pm2 plus
```

### Health Checks

```javascript
// Adicione endpoint health check
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime()
    }));
  }
});

server.listen(3000);
```

### Alertas

Configure alertas para:
- Bot offline > 5 minutos
- Erros > 10 por hora
- Latência > 500ms
- RAM > 400MB

---

## 🔧 Manutenção

### Backup Automático

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d)
zip -r "backup-$DATE.zip" src/ package.json .env
mv "backup-$DATE.zip" /backup/
```

### Updates

```bash
# Verifique updates
npm outdated

# Atualize minor versions
npm update

# Atualize major (cuidado!)
npm install discord.js@latest
```

### Logs

**Rotação de logs:**
```javascript
const winston = require('winston');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/bot-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d'
});
```

---

## 🚨 Troubleshooting Produção

### Bot Offline

**Verificação:**
```bash
# Verifique se está rodando
pm2 status

# Reinicie
pm2 restart tenkai

# Veja logs
pm2 logs tenkai
```

### Memória Crescente

**Solução:**
```bash
# Aumente limite
pm2 start index.js --max-memory-restart 300M
```

### Lentidão

1. Verifique CPU/RAM
2. Aumente cooldown
3. Reduza histórico
4. Limpe cache antigo

### Conexão API Ruim

```bash
# Verifique rede
ping 8.8.8.8

# Teste DNS
nslookup api.generativeai.google.com

# Teste SSL
curl -v https://api.generativeai.google.com
```

---

## 📈 Métricas Recomendadas

```
Métrica              | Normal    | Alerta
─────────────────────────────────────────
CPU Usage           | < 30%     | > 70%
Memory Usage        | < 200MB   | > 400MB
Resposta IA         | < 3s      | > 5s
Latência Discord    | < 100ms   | > 200ms
Uptime              | > 99%     | < 95%
Erro Rate           | < 1%      | > 5%
```

---

## 🔐 Segurança em Produção

### 1. Variáveis de Ambiente

```bash
# NUNCA faça commit de .env
echo ".env" >> .gitignore
```

### 2. Rate Limiting

```javascript
// Implemente rate limit global
const rateLimit = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  if (rateLimit.has(userId)) {
    const last = rateLimit.get(userId);
    if (now - last < 1000) return false;
  }
  rateLimit.set(userId, now);
  return true;
}
```

### 3. Validação Rigorosa

```javascript
// Sempre valide entrada
if (!userId || typeof userId !== 'string') {
  return error('Invalid userId');
}
```

### 4. Secrets Manager

```javascript
// Use AWS Secrets Manager ou similar
const secrets = require('aws-sdk').SecretsManager();

const config = await secrets.getSecretValue({
  SecretId: 'tenkai'
}).promise();
```

---

## 📞 Support & Monitoring

### Sentry Integration

```bash
npm install --save @sentry/node
```

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Capture errors
Sentry.captureException(error);
```

### Uptime Monitoring

Use serviços como:
- [UptimeRobot](https://uptimerobot.com)
- [Healthchecks.io](https://healthchecks.io)
- [OnlineOrNot](https://www.onlinenot.com)

---

## 🎯 Roadmap de Produção

**Fase 1: Deploy Inicial** (Semana 1)
- [ ] Deploy em Railway/VPS
- [ ] Testes de stress
- [ ] Monitoramento básico

**Fase 2: Otimização** (Semana 2)
- [ ] Análise de performance
- [ ] Otimizações de memória
- [ ] Caching implementado

**Fase 3: Escala** (Semana 3)
- [ ] Múltiplos shards (se necessário)
- [ ] Banco de dados
- [ ] Dashboard de controle

**Fase 4: Estabilidade** (Ongoing)
- [ ] Monitoramento 24/7
- [ ] Alertas automáticos
- [ ] Updates periódicos

---

**Tenkai está pronta para produção!** 👑 🚀

Para suporte, consulte os documentos:
- `README.md` - Visão geral
- `TROUBLESHOOTING.md` - Problemas comuns
- `DEVELOPMENT.md` - Extensões
