const { Events } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const commandsPath = join(__dirname, '..', 'commands');
    const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    let commandFound = false;
    
    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = require(filePath);
      
      if (command.data && command.data.name === commandName) {
        try {
          logger.info('⚡ Executando comando', { name: commandName, user: interaction.user.tag });
          await command.execute(interaction);
          commandFound = true;
        } catch (error) {
          logger.error('❌ Erro ao executar comando', { name: commandName, error: error.message });
          
          const reply = {
            content: '❌ Ocorreu um erro ao executar este comando.',
            ephemeral: true
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
        break;
      }
    }

    if (!commandFound) {
      logger.warn('⚠️ Comando não encontrado', { name: commandName });
    }
  }
};
