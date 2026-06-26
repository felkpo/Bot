const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const toolManager = require('../ai/toolManager');
const logger = require('../utils/logger');

const CONFIRMATION_TIMEOUT_MS = 30000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('action-stats-reset')
    .setDescription('Reseta todas as estatísticas de actions (apenas administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Verificação extra de permissão
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply({ content: '❌ Apenas administradores podem resetar as estatísticas.' });
        return;
      }

      // Pega estatísticas ANTES do reset para mostrar o que será apagado
      const beforeMetrics = toolManager.getActionMetrics();
      let totalBefore = 0;
      for (const v of Object.values(beforeMetrics.executions)) totalBefore += v;
      for (const v of Object.values(beforeMetrics.failures)) totalBefore += v;

      // Botões de confirmação
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('action_stats_reset_confirm')
          .setLabel('Confirmar reset')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️'),
        new ButtonBuilder()
          .setCustomId('action_stats_reset_cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✖️')
      );

      const confirmEmbed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('⚠️ Confirmação necessária')
        .setDescription('Esta ação vai resetar **permanentemente** as estatísticas do sistema de actions.\n\n**Esta ação não pode ser desfeita.**')
        .addFields(
          { name: 'Estatísticas que serão apagadas', value: '• Execuções\n• Falhas\n• Campos faltantes\n• Top 5\n• Timestamps', inline: false },
          { name: 'Total de registros', value: `${totalBefore} entrada(s)`, inline: true }
        )
        .setFooter({ text: 'Você tem 30 segundos para confirmar' });

      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

      // Espera o usuário clicar
      const filter = i => i.user.id === interaction.user.id && (i.customId === 'action_stats_reset_confirm' || i.customId === 'action_stats_reset_cancel');
      let confirmation;
      try {
        confirmation = await interaction.channel.awaitMessageComponent({
          filter,
          componentType: ComponentType.Button,
          time: CONFIRMATION_TIMEOUT_MS
        });
      } catch (_) {
        // Timeout — atualiza mensagem original
        const timeoutRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('action_stats_reset_confirm')
            .setLabel('Confirmar reset')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚠️')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('action_stats_reset_cancel')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
            .setDisabled(true)
        );
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('⏱️ Tempo esgotado')
          .setDescription('Nenhuma confirmação recebida em 30 segundos. Reset cancelado.')
          .setTimestamp();
        await interaction.editReply({ embeds: [timeoutEmbed], components: [timeoutRow] });
        return;
      }

      // Desabilita os botões no componente
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('action_stats_reset_confirm')
          .setLabel(confirmation.customId === 'action_stats_reset_confirm' ? 'Confirmado' : 'Confirmar reset')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️')
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('action_stats_reset_cancel')
          .setLabel(confirmation.customId === 'action_stats_reset_cancel' ? 'Cancelado' : 'Cancelar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✖️')
          .setDisabled(true)
      );

      if (confirmation.customId === 'action_stats_reset_cancel') {
        const cancelEmbed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('✖️ Reset cancelado')
          .setDescription('As estatísticas foram preservadas. Nenhum dado foi apagado.')
          .setTimestamp();
        await interaction.editReply({ embeds: [cancelEmbed], components: [disabledRow] });
        await confirmation.update({});
        logger.info('[ACTION STATS RESET] Cancelado pelo usuário', {
          user: interaction.user?.tag,
          arquivo: 'src/commands/action-stats-reset.js'
        });
        return;
      }

      // CONFIRMOU — executa o reset
      toolManager.resetMissingParameterStats();
      await confirmation.update({});

      const afterMetrics = toolManager.getActionMetrics();
      const successEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ Estatísticas resetadas')
        .setDescription(`Reset concluído com sucesso por **${interaction.user.tag}**`)
        .addFields(
          { name: 'Registros antes', value: `${totalBefore}`, inline: true },
          { name: 'Registros depois', value: '0', inline: true },
          { name: 'Persistido em', value: '`data/action-stats.json`', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Próximo reset poderá ser feito em qualquer momento' });

      logger.info('[ACTION STATS RESET] Reset executado com sucesso', {
        user: interaction.user?.tag,
        registrosAntes: totalBefore,
        lastReset: afterMetrics.lastReset,
        arquivo: 'src/commands/action-stats-reset.js'
      });

      await interaction.editReply({ embeds: [successEmbed], components: [disabledRow] });
    } catch (error) {
      logger.error('❌ Erro no comando action-stats-reset', { error: error.message, stack: error.stack });
      try {
        await interaction.editReply({ content: '❌ Falha ao resetar estatísticas.' });
      } catch (_) {}
    }
  }
};
