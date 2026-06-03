require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('./src/utils/logger');
const config = require('./src/config/config');

// Valida configuração
if (!config.DISCORD_TOKEN) {
  logger.error('❌ DISCORD_TOKEN não configurada no arquivo .env');
  process.exit(1);
}

// Cria cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Carrega eventos
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

// Login
logger.info('🔐 Conectando ao Discord...');
client.login(config.DISCORD_TOKEN).catch(error => {
  logger.error('❌ Erro ao fazer login', { error: error.message });
  process.exit(1);
});
