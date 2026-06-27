// [STARTUP 0] Diagnóstico de rede e versões
const dns = require('dns');
const os = require('os');

// Informações de versão
console.log('[STARTUP 0] Node Version:', process.version);
console.log('[STARTUP 0] Plataforma:', process.platform, os.type(), os.release());
console.log('[STARTUP 0] FORCE_IPV4:', process.env.FORCE_IPV4 || '(não definido)');
console.log('[STARTUP 0] HTTP_PROXY:', process.env.HTTP_PROXY || process.env.http_proxy || '(não definido)');
console.log('[STARTUP 0] HTTPS_PROXY:', process.env.HTTPS_PROXY || process.env.https_proxy || '(não definido)');

// Verificar versão do undici
try {
  const undiciPkg = require('undici/package.json');
  console.log('[STARTUP 0] Undici Version:', undiciPkg.version);
} catch (_) {
  console.log('[STARTUP 0] Undici Version: (não encontrado como módulo separado)');
}

// Verificar timeout padrão do undici (connect timeout = 10s default)
try {
  const { Agent } = require('undici');
  const a = new Agent();
  const opts = a.options || {};
  console.log('[STARTUP 0] Undici connectTimeout:', opts.connectTimeout || (opts.connect?.timeout) || 'default 10000ms');
  console.log('[STARTUP 0] Undici bodyTimeout:', opts.bodyTimeout || 'default (sem timeout)');
  console.log('[STARTUP 0] Undici headersTimeout:', opts.headersTimeout || 'default  (sem timeout)');
} catch (_) {}

// FORCE_IPV4: aplicar ordem de resolução DNS
if (process.env.FORCE_IPV4 === 'true') {
  dns.setDefaultResultOrder('ipv4first');
  console.log('[STARTUP 0] DNS configurado para IPv4 primeiro (FORCE_IPV4=true)');
} else {
  console.log('[STARTUP 0] DNS usando ordem padrão (IPv6/IPv4)');
}

// Diagnóstico rápido de DNS (não bloqueante)
dns.lookup('discord.com', { all: true, family: 0 }, (err, addrs) => {
  if (err) console.log('[STARTUP 0] DNS discord.com: ERRO', err.message);
  else addrs.forEach(a => console.log('[STARTUP 0] DNS discord.com:', a.address, a.family === 4 ? 'IPv4' : 'IPv6'));
});
dns.lookup('openrouter.ai', { all: true, family: 0 }, (err, addrs) => {
  if (err) console.log('[STARTUP 0] DNS openrouter.ai: ERRO', err.message);
  else addrs.forEach(a => console.log('[STARTUP 0] DNS openrouter.ai:', a.address, a.family === 4 ? 'IPv4' : 'IPv6'));
});

// [STARTUP 1] Carregamento do dotenv
console.log('[STARTUP 1] Carregando variáveis de ambiente...');
require('dotenv').config();
console.log('[STARTUP 1] Variáveis de ambiente carregadas');

// [STARTUP 2] Carregamento da config
console.log('[STARTUP 2] Carregando configuração...');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('./src/utils/logger');
const config = require('./src/config/config');
console.log('[STARTUP 2] Configuração carregada');

// [STARTUP 2.2] Configurar Undici Agent global com connectTimeout maior
// O padrão do undici é 10000ms (10s), o que causa UND_ERR_CONNECT_TIMEOUT
// intermitente em redes com firewall ou latência variável.
// Aumentando para 30000ms (30s) para reduzir essas falhas.
// Este Agent será usado automaticamente por:
//   - Discord.js (@discordjs/rest via undici)
//   - OpenRouter (fetch nativo do Node 18+ também usa o Agent global do undici)
//   - Qualquer outra chamada HTTP que use undici
const { Agent, setGlobalDispatcher } = require('undici');
setGlobalDispatcher(new Agent({
  connect: {
    timeout: 30000
  }
}));
console.log('[STARTUP 2.2] Undici Agent configurado com connectTimeout=30000ms');

// [STARTUP 2.5] Validação da configuração
console.log('[STARTUP 2.5] Validando configuração...');
const { runValidation } = require('./src/config/validator');
runValidation();

// [STARTUP 2.6] Descoberta automática de Actions
console.log('[STARTUP 2.6] Descobrindo actions...');
const { discoverAndRegisterActions } = require('./src/ai/actionDiscovery');
discoverAndRegisterActions();
console.log('[STARTUP 2.6] Actions descobertas');

// Valida configuração
if (!config.DISCORD_TOKEN) {
  logger.error('❌ DISCORD_TOKEN não configurada no arquivo .env');
  process.exit(1);
}

// [STARTUP 3] Criação do client Discord
console.log('[STARTUP 3] Criando cliente Discord...');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});
console.log('[STARTUP 3] Cliente Discord criado');

// [STARTUP 4] Carregamento dos eventos
console.log('[STARTUP 4] Carregando eventos...');
const eventsPath = join(__dirname, 'src', 'events');
const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

logger.info('📥 Carregando eventos...', { count: eventFiles.length });

for (const file of eventFiles) {
  const filePath = join(eventsPath, file);
  const event = require(filePath);

  if (event.name && event.execute) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    logger.debug('✅ Evento carregado', { name: event.name });
  }
}
console.log('[STARTUP 4] Eventos carregados:', eventFiles.length);

// Tratamento de erro
client.on('error', error => {
  logger.error('❌ Erro do cliente Discord', { error: error.message });
});

process.on('unhandledRejection', error => {
  logger.error('❌ Promise rejeição não tratada', { error: error.message });
});

process.on('uncaughtException', error => {
  logger.error('❌ Exceção não tratada', { error: error.message });
  process.exit(1);
});

// [STARTUP 5] Login no Discord com retry automático
const MAX_LOGIN_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

async function loginWithRetry(attempt = 1) {
  console.log(`[STARTUP 5] Tentativa de login ${attempt}/${MAX_LOGIN_RETRIES}...`);
  logger.info(`🔐 Conectando ao Discord... (tentativa ${attempt}/${MAX_LOGIN_RETRIES})`);
  
  try {
    await client.login(config.DISCORD_TOKEN);
    console.log(`[STARTUP 5] LOGIN CONCLUÍDO - Bot conectado com sucesso na tentativa ${attempt}`);
    logger.info(`✅ Bot conectado com sucesso na tentativa ${attempt}`);
  } catch (error) {
    console.log(`[STARTUP 5] Tentativa ${attempt} falhou: ${error.message}`);
    logger.error(`❌ Erro ao fazer login (tentativa ${attempt}/${MAX_LOGIN_RETRIES})`, {
      error: error.message,
      errorStack: error.stack,
      attempt: attempt,
      maxRetries: MAX_LOGIN_RETRIES
    });
    
    if (attempt < MAX_LOGIN_RETRIES) {
      console.log(`[STARTUP 5] Aguardando ${RETRY_DELAY_MS / 1000}s antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return loginWithRetry(attempt + 1);
    } else {
      console.log(`[STARTUP 5] LOGIN FALHOU - Todas as ${MAX_LOGIN_RETRIES} tentativas esgotadas`);
      logger.error(`❌ Falha fatal no login após ${MAX_LOGIN_RETRIES} tentativas`);
      process.exit(1);
    }
  }
}

console.log('[STARTUP 5] LOGIN INICIADO');
loginWithRetry().catch(error => {
  console.log('[STARTUP 5] ERRO FATAL:', error.message);
  logger.error('❌ Erro fatal no login', { error: error.message, stack: error.stack });
  process.exit(1);
});
