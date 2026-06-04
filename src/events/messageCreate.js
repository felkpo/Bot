const { Events, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const gemini = require('../ai/ollama');
const contextManager = require('../ai/contextManager');
const { shouldActivateAI, stripPrefix } = require('../utils/regex');
const { tryParseStructuredResponse, executeToolAction } = require('../ai/toolManager');
const config = require('../config/config');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignora mensagens do bot
    if (message.author.bot) {
      if (config.FEATURES.BOT_IGNORE_ENABLED) {
        logger.debug('🤖 Mensagem de bot ignorada', { author: message.author.tag });
      }
      return;
    }

    // Ignora DMs
    if (message.channel.type === ChannelType.DM) {
      logger.debug('💌 DM ignorada', { author: message.author.tag });
      return;
    }

    try {
      const content = message.content;
      const isMentioned = message.mentions.has(message.client.user.id);

      // Verifica se deve ativar IA
      const shouldActivate = shouldActivateAI(content, isMentioned);

      if (!shouldActivate) {
        return;
      }

      // Verifica cooldown
      if (contextManager.isOnCooldown(message.author.id)) {
        const remaining = contextManager.getCooldownTimeRemaining(message.author.id);
        logger.debug('⏳ Usuário em cooldown', {
          user: message.author.tag,
          remainingMs: remaining
        });
        return;
      }

      // Mostra que está digitando
      await message.channel.sendTyping();

      // Remove o prefixo
      const userMessage = stripPrefix(content);

      logger.info('💬 Mensagem de IA recebida', {
        user: message.author.tag,
        channel: message.channel.name,
        messageLength: userMessage.length,
        mentioned: isMentioned
      });

      // IA normal
      if (!config.FEATURES.AI_ENABLED) {
        return;
      }

      try {
        // Obtém contexto do usuário e memórias relevantes
        const context = await contextManager.getPromptContext(
          message.author.id,
          message.guildId,
          message.channelId
        );

        const startTime = Date.now();
        const response = await gemini.generateResponse(userMessage, context);
        const responseTime = Date.now() - startTime;

        logger.info('✅ Resposta de IA gerada', {
          user: message.author.tag,
          responseTime: `${responseTime}ms`,
          responseLength: response.length
        });

        const parsedAction = tryParseStructuredResponse(response);
        if (parsedAction && parsedAction.action) {
          const actionResult = await executeToolAction(parsedAction, message);
          if (actionResult.success) {
            await contextManager.addMessage(
              message.author.id,
              message.guildId,
              'user',
              userMessage,
              message.channelId,
              message.channel.name,
              message.author.tag
            );
            await contextManager.addMessage(
              message.author.id,
              message.guildId,
              'assistant',
              actionResult.contextMessage || `Ação ${parsedAction.action} executada com sucesso.`,
              message.channelId,
              message.channel.name,
              config.BOT_NAME
            );

            await message.reply({
              content: actionResult.summary,
              allowedMentions: { repliedUser: false }
            });
            return;
          }

          await contextManager.addMessage(
            message.author.id,
            message.guildId,
            'user',
            userMessage,
            message.channelId,
            message.channel.name,
            message.author.tag
          );
          await message.reply({
            content: actionResult.error
              ? `❌ ${actionResult.error}`
              : actionResult.summary || '❌ Ação não executada.',
            allowedMentions: { repliedUser: false }
          });
          return;
        }

        // Adiciona ao contexto
        await contextManager.addMessage(
          message.author.id,
          message.guildId,
          'user',
          userMessage,
          message.channelId,
          message.channel.name,
          message.author.tag
        );
        await contextManager.addMessage(
          message.author.id,
          message.guildId,
          'assistant',
          response,
          message.channelId,
          message.channel.name,
          config.BOT_NAME
        );

        // Envia resposta em chunks se muito longa
        if (response.length > 2000) {
          const chunks = response.match(/[\s\S]{1,1990}/g) || [];
          for (const chunk of chunks) {
            await message.reply({
              content: chunk,
              allowedMentions: { repliedUser: false }
            });
          }
        } else {
          await message.reply({
            content: response,
            allowedMentions: { repliedUser: false }
          });
        }
      } catch (error) {
        logger.error('❌ Erro ao gerar resposta de IA', { error: error.message });

        let errorMsg = '❌ Desculpe, tive um problema ao processar sua mensagem.';

        if (error.message.includes('OLLAMA_URL') || error.message.toLowerCase().includes('ollama')) {
          errorMsg = '❌ Erro de configuração: OLLAMA_URL inválida ou Ollama indisponível.';
        } else if (error.message.includes('limite')) {
          errorMsg = '❌ Limite de requisições excedido. Tente novamente em alguns momentos.';
        } else if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
          errorMsg = '❌ Conexão com IA expirou. Tente novamente.';
        }

        await message.reply({
          content: errorMsg,
          allowedMentions: { repliedUser: false }
        });
      }
    } catch (error) {
      logger.error('❌ Erro não tratado em messageCreate', { error: error.message });
    }
  }
};
