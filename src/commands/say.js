const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, botHasPermission, collectResponse, findChannel } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Enviar uma mensagem via modo interativo')
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

      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ 
          content: '❌ Use este comando em um canal de texto.',
          ephemeral: true 
        });
        return;
      }

      // Pergunta o canal
      await interaction.reply({ 
        content: '📍 Qual canal você deseja enviar a mensagem?',
        ephemeral: false 
      });

      const channelAnswer = await collectResponse(interaction.channel, interaction.user.id, 60000);
      if (!channelAnswer) {
        await interaction.followUp({ 
          content: '❌ Tempo esgotado.',
          ephemeral: false 
        });
        return;
      }

      // Tenta encontrar o canal
      let targetChannel = findChannel(interaction.guild, channelAnswer.content, channelAnswer);

      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.followUp({ 
          content: '❌ Canal inválido. Cancelando.',
          ephemeral: false 
        });
        return;
      }

      // Verifica permissão do bot
      if (!botHasPermission(targetChannel, interaction.client, 'SendMessages')) {
        await interaction.followUp({ 
          content: `❌ Não tenho permissão para enviar mensagens em ${targetChannel.name}.`,
          ephemeral: false 
        });
        return;
      }

      // Pergunta a mensagem
      await interaction.followUp({ 
        content: '💬 Qual será a mensagem? (você pode enviar texto com anexos)',
        ephemeral: false 
      });

      const msgAnswer = await collectResponse(interaction.channel, interaction.user.id, 60000);
      if (!msgAnswer) {
        await interaction.followUp({ 
          content: '❌ Tempo esgotado. Cancelando.',
          ephemeral: false 
        });
        return;
      }

      // Prepara opções de envio
      const sendOptions = {};
      if (msgAnswer.content) sendOptions.content = msgAnswer.content;
      if (msgAnswer.attachments && msgAnswer.attachments.size > 0) {
        sendOptions.files = Array.from(msgAnswer.attachments.values()).map(a => a.url);
      }

      // Envia a mensagem
      await targetChannel.send(sendOptions);

      logger.info('✉️ Mensagem interativa enviada', {
        channel: targetChannel.name,
        by: interaction.user.tag,
        hasAttachments: msgAnswer.attachments?.size > 0
      });

      await interaction.followUp({ 
        content: `✅ Mensagem enviada com sucesso em ${targetChannel}!`,
        ephemeral: false 
      });
    } catch (error) {
      logger.error('❌ Erro no comando say', { error: error.message });
      await interaction.reply({ 
        content: '❌ Erro ao processar comando. Verifique permissões.',
        ephemeral: true 
      });
    }
  }
};
