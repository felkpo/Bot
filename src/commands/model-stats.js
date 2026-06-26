const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const openrouter = require('../ai/openrouter');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('model-stats')
    .setDescription('Mostra estatísticas de uso dos modelos do pool OpenRouter'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const stats = openrouter.getModelStatsSnapshot();
      const activePool = openrouter.getActivePool();
      const cooldowns = openrouter.getActiveCooldowns();
      const cooldownsByModel = new Map(Object.entries(cooldowns).map(([k, v]) => [k, v]));

      const allModels = new Set([...Object.keys(stats), ...activePool]);

      if (allModels.size === 0 && Object.keys(cooldowns).length === 0) {
        await interaction.editReply({
          content: '📊 **Model Stats**\n\nNenhuma estatística registrada ainda. Use o bot para gerar dados.'
        });
        return;
      }

      const lines = [];
      const models = [...allModels].map(name => {
        const s = stats[name] || { success: 0, failed: 0, rateLimit: 0, totalResponseTime: 0, calls: 0 };
        const total = s.success + s.failed;
        const successRate = total > 0 ? Math.round((s.success / total) * 100) : 0;
        const avgTime = s.calls > 0 ? Math.round((s.totalResponseTime / s.calls) / 100) / 10 : 0;

        let status;
        if (cooldownsByModel.has(name)) {
          const cd = cooldownsByModel.get(name);
          status = `🔴 Cooldown (restam ${cd.remainingMin}min)`;
        } else if (activePool.includes(name)) {
          status = total > 0
            ? (successRate >= 90 ? '🟢 Online' : successRate >= 70 ? '🟡 Online' : '🟠 Online')
            : '⚪ Online (sem uso)';
        } else {
          status = '⚫ Não encontrado (removido do pool)';
        }

        const lastSeg = name.split('/').pop().replace(':free', '').substring(0, 30);
        return {
          name,
          lastSeg,
          success: s.success,
          failed: s.failed,
          rateLimit: s.rateLimit,
          successRate,
          avgTime,
          status,
          calls: s.calls
        };
      }).sort((a, b) => {
        if (a.status.includes('Não encontrado')) return 1;
        if (b.status.includes('Não encontrado')) return -1;
        if (a.status.includes('Cooldown')) return 1;
        if (b.status.includes('Cooldown')) return -1;
        return b.successRate - a.successRate || b.success - a.success;
      });

      let totalSuccess = 0, totalFailed = 0, totalRateLimit = 0;
      for (const m of models) {
        totalSuccess += m.success;
        totalFailed += m.failed;
        totalRateLimit += m.rateLimit;
        lines.push(
          `${m.status.split(' ')[0]} **${m.lastSeg}**\n` +
          `   Sucessos: ${m.success} | Falhas: ${m.failed} | 429: ${m.rateLimit} | Taxa: **${m.successRate}%** | Tempo: **${m.avgTime}s**\n` +
          `   ${m.status}`
        );
      }

      const top3 = models.filter(m => m.status.includes('Online') && m.success > 0).slice(0, 3);
      const top3Text = top3.length > 0
        ? top3.map((m, i) => `**${i + 1}.** \`${m.lastSeg}\` — ${m.successRate}% (${m.success} sucessos)`).join('\n')
        : 'Nenhum modelo usado ainda';

      const textBlock = `📊 **Estatísticas do Pool de Modelos**\n\n` +
        `✅ Total sucessos: **${totalSuccess}**\n` +
        `❌ Total falhas: **${totalFailed}**\n` +
        `🚦 Rate limits: **${totalRateLimit}**\n` +
        `📈 Modelos: **${models.length}** | Pool ativo: **${activePool.length}**\n\n` +
        `🏆 **Top 3 mais confiáveis**\n${top3Text}\n\n` +
        `📋 **Detalhamento por modelo**\n` + lines.join('\n\n');

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📊 Painel de Modelos — OpenRouter Pool')
        .setDescription('Métricas de uso, falhas e status de cada modelo.')
        .addFields(
          { name: '✅ Total sucessos', value: `${totalSuccess}`, inline: true },
          { name: '❌ Total falhas', value: `${totalFailed}`, inline: true },
          { name: '🚦 Rate limits (429)', value: `${totalRateLimit}`, inline: true },
          { name: '🏆 Top 3 mais confiáveis', value: top3Text, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Pool ativo: ${activePool.length} | Persistido em data/model-stats.json` });

      for (const line of lines.slice(0, 20)) {
        const [title, ...rest] = line.split('\n');
        embed.addFields({ name: title.trim(), value: rest.join('\n') || '—', inline: false });
      }

      logger.info('[MODEL STATS] Painel consultado', {
        user: interaction.user?.tag,
        modelsMonitored: models.length,
        totalSuccess,
        totalFailed,
        arquivo: 'src/commands/model-stats.js'
      });

      await interaction.editReply({
        content: textBlock.length > 1900 ? textBlock.substring(0, 1900) + '\n...(truncado)' : textBlock,
        embeds: [embed]
      });
    } catch (error) {
      logger.error('❌ Erro no comando model-stats', { error: error.message, stack: error.stack });
      try {
        await interaction.editReply({ content: '❌ Falha ao consultar estatísticas de modelos.' });
      } catch (_) {}
    }
  }
};