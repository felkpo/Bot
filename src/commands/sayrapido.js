const { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { isAdmin, botHasPermission } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sayrapido')
    .setDescription('Enviar uma mensagem rápida via opções do comando')
    .addChannelOption(opt => 
      opt.setName('channel')
        .setDescription('Canal para enviar a mensagem')
        .setRequired(true)
    )
    .addStringOption(opt => 
      opt.setName('message')
        .setDescription('Mensagem que o bot deve enviar')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  
  async execute(interaction) {
    try {
      // Verifica se é admin
      if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
          content: '❌ Apenas administradores podem usar este comando.',
          ephemeral: true 
        });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message', true);

      // Verifica se o canal é de texto
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ 
          content: '❌ Canal inválido. Use um canal de texto.',
          ephemeral: true 
        });
        return;
      }

      // Verifica permissão do bot
      if (!botHasPermission(channel, interaction.client, 'SendMessages')) {
        await interaction.reply({ 
          content: `❌ Não tenho permissão para enviar mensagens em ${channel.name}.`,
          ephemeral: true 
        });
        return;
      }

      // Envia a mensagem
      await channel.send({ content: message });
      
      logger.info('✉️ Mensagem rápida enviada', {
        channel: channel.name,
        by: interaction.user.tag,
        messageLength: message.length
      });

      await interaction.reply({ 
        content: `✅ Mensagem enviada com sucesso em ${channel}!`,
        ephemeral: false 
      });
    } catch (error) {
      logger.error('❌ Erro ao enviar mensagem rápida', { error: error.message });
      await interaction.reply({ 
        content: '❌ Erro ao enviar a mensagem. Verifique permissões.',
        ephemeral: true 
      });
    }
  }
};
