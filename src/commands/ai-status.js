const { SlashCommandBuilder } = require('discord.js');
const aiProvider = require('../ai/provider');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai-status')
    .setDescription('Verifica a saúde do sistema de IA e dos provedores.'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const isHealthy = await aiProvider.healthCheck();
      const statuses = aiProvider.getProviderStatuses();
      const available = statuses.filter(s => s.isAvailable).map(s => s.name);
      const modelInfo = aiProvider.getModelInfo();

      let statusText = `**Sistema Multi-Provedor:** ${isHealthy ? '✅ OPERACIONAL' : '❌ FALHA GLOBAL'}\n\n`;
      statusText += `**Provedores Disponíveis:** ${available.length > 0 ? available.join(', ') : 'Nenhum'}\n`;
      statusText += `**Ordem de Fallback:** ${statuses.map(s => s.name).join(' → ')}\n`;
      statusText += `**Modelo Primário Ativo:** ${modelInfo ? `\`${modelInfo.name}\` (do provedor \`${modelInfo.provider}\`)` : 'N/A'}\n\n`;

      statusText += '**Status Detalhado:**\n';
      statuses.forEach(s => {
        let emoji = '⚫';
        if (s.isAvailable) emoji = '🟢';
        if (s.status.toLowerCase().includes('cooldown')) emoji = '🔴';
        if (!s.isAvailable && !s.status.toLowerCase().includes('cooldown')) emoji = '⚪';
        statusText += `${emoji} **${s.name}:** ${s.status}\n`;
      });

      if (isHealthy) {
        statusText += '\n*O sistema tentará gerar uma resposta usando a cadeia de fallback.*';
      } else {
        statusText += '\n*Nenhum provedor está disponível. A IA não irá responder.*';
      }

      await interaction.editReply({ content: statusText });
    } catch (error) {
      logger.error('❌ Erro no comando ai-status', { error: error.message });
      await interaction.editReply({ content: '❌ Falha ao executar o diagnóstico do sistema de IA.' });
    }
  }
};