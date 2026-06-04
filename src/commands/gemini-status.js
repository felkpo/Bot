const { SlashCommandBuilder } = require('discord.js');
const ollama = require('../ai/ollama');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ollama-status')
    .setDescription('Verifica a conexão Ollama e exibe o modelo, status e tempo de resposta'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const start = Date.now();
      const healthy = await ollama.healthCheck();
      let responseTime = 0;
      let snippet = '';
      if (healthy) {
        const t0 = Date.now();
        try {
          const text = await ollama.generateResponse('Teste de diagnóstico da conexão Ollama.', {}, 8000);
          snippet = (text || '').slice(0, 200);
        } catch (err) {
          logger.warn('⚠️ Falha ao gerar texto de diagnóstico Ollama', { error: err.message });
        }
        responseTime = Date.now() - t0;
      }

      const content = `📡 Ollama Diagnostics\n` +
        `• URL: **${process.env.OLLAMA_URL || 'não configurado'}**\n` +
        `• Modelo: **${process.env.OLLAMA_MODEL || 'qwen3:8b'}**\n` +
        `• Status: **${healthy ? 'OK' : 'OFFLINE'}**\n` +
        `• Tempo de resposta (geração): **${responseTime}ms**\n` +
        (healthy ? `• Exemplo de resposta: ${snippet}` : '• Ollama não está disponível');

      await interaction.editReply({ content });
    } catch (error) {
      logger.error('❌ Erro no comando ollama-status', { error: error.message });
      await interaction.editReply({ content: '❌ Falha ao executar diagnóstico Ollama.' });
    }
  }
};
