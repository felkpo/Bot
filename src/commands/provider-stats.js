const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const provider = require('../ai/provider');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('provider-stats')
    .setDescription('Mostra estatísticas dos provedores de IA (Gemini, Groq, WorkersAI, OpenRouter)'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const stats = provider.getProviderStatsSnapshot();
      const cooldowns = provider.getActiveProviderCooldowns();
      const available = provider.getAvailableProviders();

      if (Object.keys(stats).length === 0 && Object.keys(cooldowns).length === 0) {
        await interaction.editReply({
          content: '📊 **Provider Stats**\n\nNenhuma estatística registrada ainda. Use o bot para gerar dados.'
        });
        return;
      }

      const lines = [];
      const providers = ['Gemini', 'Groq', 'WorkersAI', 'OpenRouter'];

      for (const name of providers) {
        const s = stats[name] || { success: 0, failed: 0, cooldowns: 0, totalResponseTime: 0, calls: 0 };
        const total = s.success + s.failed;
        const successRate = total > 0 ? Math.round((s.success / total) * 100) : 0;
        const avgTime = s.calls > 0 ? Math.round((s.totalResponseTime / s.calls) / 100) / 10 : 0;

        let status;
        if (cooldowns[name]) {
          const cd = cooldowns[name];
          status = `🔴 Cooldown (restam ${cd.remainingMin}min)`;
        } else if (available.includes(name)) {
          status = total > 0
            ? (successRate >= 90 ? '🟢 Online' : successRate >= 70 ? '🟡 Online' : '🟠 Online')
            : '⚪ Online (sem uso)';
        } else {
          status = '⚫ Desativado (sem API key)';
        }

        lines.push(
          `${status.split(' ')[0]} **${name}**\n` +
          `   Sucessos: ${s.success} | Falhas: ${s.failed} | Cooldowns: ${s.cooldowns} | Taxa: **${successRate}%** | Tempo médio: **${avgTime}s**\n` +
          `   ${status}`
        );
      }

      const totalSuccess = Object.values(stats).reduce((sum, s) => sum + s.success, 0);
      const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);
      const totalCooldowns = Object.values(stats).reduce((sum, s) => sum + s.cooldowns, 0);

      const textBlock = `📊 **Estatísticas dos Provedores de IA**\n\n` +
        `✅ Total sucessos: **${totalSuccess}**\n` +
        `❌ Total falhas: **${totalFailed}**\n` +
        `🔄 Total cooldowns: **${totalCooldowns}**\n` +
        `📈 Provedores ativos: **${available.length}/4**\n` +
        `🔄 Ordem de fallback: **Gemini → Groq → WorkersAI → OpenRouter**\n\n` +
        `📋 **Detalhamento por provedor**\n` + lines.join('\n\n');

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📊 Painel de Provedores — Multi-Provider Fallback')
        .setDescription('Métricas de uso, falhas e status de cada provedor.')
        .addFields(
          { name: '✅ Total sucessos', value: `${totalSuccess}`, inline: true },
          { name: '❌ Total falhas', value: `${totalFailed}`, inline: true },
          { name: '🔄 Total cooldowns', value: `${totalCooldowns}`, inline: true },
          { name: '📈 Provedores ativos', value: `${available.length}/4`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Persistido em data/provider-stats.json` });

      for (const line of lines) {
        const [title, ...rest] = line.split('\n');
        embed.addFields({ name: title.trim(), value: rest.join('\n') || '—', inline: false });
      }

      logger.info('[PROVIDER STATS] Painel consultado', {
        user: interaction.user?.tag,
        providersMonitored: Object.keys(stats).length,
        totalSuccess,
        totalFailed,
        arquivo: 'src/commands/provider-stats.js'
      });

      await interaction.editReply({
        content: textBlock.length > 1900 ? textBlock.substring(0, 1900) + '\n...(truncado)' : textBlock,
        embeds: [embed]
      });
    } catch (error) {
      logger.error('❌ Erro no comando provider-stats', { error: error.message, stack: error.stack });
      try {
        await interaction.editReply({ content: '❌ Falha ao consultar estatísticas dos provedores.' });
      } catch (_) {}
    }
  }
};