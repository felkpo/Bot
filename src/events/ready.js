const { Events, REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('../utils/logger');
const ollama = require('../ai/ollama');
const config = require('../config/config');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`✅ Bot online como ${client.user.tag}`);

    // Carrega comandos
    const commands = [];
    const commandsPath = join(__dirname, '..', 'commands');
    const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = require(filePath);
      if (command.data && command.execute) {
        commands.push(command.data.toJSON());
      }
    }

    // Registra comandos globalmente
    if (config.CLIENT_ID) {
      try {
        logger.info('📝 Registrando comandos...', { count: commands.length });
        const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });
        logger.info('✅ Comandos registrados com sucesso');
      } catch (error) {
        logger.error('❌ Erro ao registrar comandos', { error: error.message });
      }
    } else {
      logger.warn('⚠️ CLIENT_ID não configurada - comandos não foram registrados');
    }

    // Testa conexão com Ollama
    if (config.FEATURES.AI_ENABLED) {
      try {
        const isHealthy = await ollama.healthCheck();
        if (isHealthy) {
          logger.info('✅ Ollama conectada e funcionando', { url: config.OLLAMA_URL, model: config.OLLAMA_MODEL });
        } else {
          logger.warn('⚠️ Ollama conectada mas com problemas');
        }
      } catch (error) {
        logger.error('❌ Erro ao conectar com Ollama', { error: error.message });
      }
    }

    logger.info('🚀 Royal Prussian pronta para servir!');
  }
};
