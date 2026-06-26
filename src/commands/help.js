const { SlashCommandBuilder } = require('discord.js');
const { generateHelpEmbed } = require('../utils/helpGenerator');

module.exports = {
  category: 'Outros',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra todos os comandos disponíveis do bot'),

  async execute(interaction) {
    const helpEmbed = generateHelpEmbed();
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }
};
