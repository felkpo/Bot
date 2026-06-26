const { SlashCommandBuilder } = require('discord.js');
const aiProvider = require('../ai/provider');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ollama-status')
    .setDescription('Verifica a conexão OpenRouter e exibe o modelo, status e tempo de resposta'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const healthy = await aiProvider.healthCheck();
      let responseTime = 0;
      let snippet = '';
      if (healthy) {
        const t0 = Date.now();
        try {
          const text = await aiProvider.generateResponse('Teste de diagnóstico da conexão OpenRouter.', {}, 8000);
          snippet = (text || '').slice(0, 200);
        } catch (err) {
          logger.warn('⚠️ Falha ao gerar texto de diagnóstico OpenRouter', { error: err.message });
        }
        responseTime = Date.now() - t0;
      }

      const content = `📡 OpenRouter Diagnostics\n` +
        `• URL: **${process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions'}**\n` +
        `• Modelo: **${process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-7b-instruct'}**\n` +
        `• Status: **${healthy ? 'OK' : 'OFFLINE'}**\n` +
        `• Tempo de resposta (geração): **${responseTime}ms**\n` +
        (healthy ? `• Exemplo de resposta: ${snippet}` : '• OpenRouter não está disponível');

      await interaction.editReply({ content });
    } catch (error) {
      logger.error('❌ Erro no comando ollama-status', { error: error.message });
      await interaction.editReply({ content: '❌ Falha ao executar diagnóstico OpenRouter.' });
    }
  }
};
