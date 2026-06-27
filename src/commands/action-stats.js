const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const actionStatsManager = require('../managers/actionStatsManager');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('action-stats')
    .setDescription('Painel de diagnóstico do sistema de actions: execuções, falhas, top 5'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const metrics = actionStatsManager.getActionMetrics();
      const { executions, failures, missingParameters, lastReset, lastUpdate } = metrics;

      // Calcula totais
      let totalExec = 0, totalFail = 0, totalMissingFields = 0;
      for (const v of Object.values(executions)) totalExec += v;
      for (const v of Object.values(failures)) totalFail += v;
      for (const action in missingParameters) {
        for (const f in missingParameters[action]) totalMissingFields += missingParameters[action][f];
      }
      const overallSuccessRate = totalExec > 0 ? Math.round(((totalExec - totalFail) / totalExec) * 100) : 0;

      // ════════════════════════════════════════════════════════
      // RANKING TOP 5
      // ════════════════════════════════════════════════════════
      const ranking = Object.entries(executions)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // ════════════════════════════════════════════════════════
      // TABELA DETALHADA
      // ════════════════════════════════════════════════════════
      const tableLines = [];
      for (const [action, exec] of Object.entries(executions).sort((a, b) => b[1] - a[1])) {
        const fail = failures[action] || 0;
        const success = exec - fail;
        const rate = exec > 0 ? Math.round((success / exec) * 100) : 0;
        const rateBar = rate >= 90 ? '🟢' : rate >= 70 ? '🟡' : '🔴';
        const missing = missingParameters[action] || {};
        const missingInfo = Object.keys(missing).length > 0
          ? `\n   └ campos faltantes: ${Object.entries(missing).map(([f, c]) => `\`${f}\` (${c})`).join(', ')}`
          : '';
        tableLines.push(`${rateBar} **${action}**\n   Executadas: ${exec} | Falhas: ${fail} | Taxa: **${rate}%**${missingInfo}`);
      }

      // ════════════════════════════════════════════════════════
      // EMBED PRINCIPAL
      // ════════════════════════════════════════════════════════
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📊 Painel de Diagnóstico — Action Stats')
        .setDescription('Métricas em tempo real de uso do sistema de actions.')
        .addFields(
          { name: '📈 Total de execuções', value: `${totalExec}`, inline: true },
          { name: '❌ Total de falhas', value: `${totalFail}`, inline: true },
          { name: `${overallSuccessRate >= 90 ? '🟢' : overallSuccessRate >= 70 ? '🟡' : '🔴'} Taxa de sucesso`, value: `**${overallSuccessRate}%**`, inline: true },
          { name: '⚠️ Campos faltantes (total)', value: `${totalMissingFields}`, inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: lastReset
            ? `Último reset: ${new Date(lastReset).toLocaleString('pt-BR')}`
            : 'Estatísticas zeram ao reiniciar ou use /action-stats-reset'
        });

      // Adiciona Top 5
      if (ranking.length > 0) {
        const topText = ranking
          .map((r, i) => `**${i + 1}.** \`${r.action}\` — ${r.count} execuções`)
          .join('\n');
        embed.addFields({ name: '🏆 Top 5 Actions Mais Usadas', value: topText, inline: false });
      }

      // Adiciona tabela detalhada (até 18 fields restantes)
      const detailFields = tableLines.slice(0, 18);
      for (const line of detailFields) {
        const [title, ...rest] = line.split('\n');
        embed.addFields({ name: title.trim(), value: rest.join('\n') || '—', inline: false });
      }

      // Texto puro complementar
      let textBlock = `📊 **Painel de Diagnóstico — Action Stats**\n\n` +
        `📈 Total de execuções: **${totalExec}**\n` +
        `❌ Total de falhas: **${totalFail}**\n` +
        `Taxa de sucesso: **${overallSuccessRate}%**\n` +
        `⚠️ Campos faltantes: **${totalMissingFields}**\n`;

      if (ranking.length > 0) {
        textBlock += `\n🏆 **Top 5 Mais Usadas**\n` +
          ranking.map((r, i) => `${i + 1}. \`${r.action}\` — ${r.count}`).join('\n') + '\n';
      }

      if (tableLines.length > 0) {
        textBlock += `\n📋 **Detalhamento**\n` + tableLines.join('\n\n');
      }

      logger.info('[ACTION STATS] Painel consultado', {
        user: interaction.user?.tag,
        totalExec,
        totalFail,
        overallSuccessRate,
        arquivo: 'src/commands/action-stats.js'
      });

      await interaction.editReply({
        content: textBlock.length > 1900 ? textBlock.substring(0, 1900) + '\n...(truncado)' : textBlock,
        embeds: [embed]
      });
    } catch (error) {
      logger.error('❌ Erro no comando action-stats', { error: error.message, stack: error.stack });
      await interaction.editReply({ content: '❌ Falha ao consultar painel de estatísticas.' });
    }
  }
};
