const { Events, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const gemini = require('../ai/gemini');
const contextManager = require('../ai/contextManager');
const AdminIntentions = require('../ai/adminIntentions');
const { shouldActivateAI, stripPrefix } = require('../utils/regex');
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

      // Verifica intenções administrativas
      if (config.FEATURES.ADMIN_COMMANDS_ENABLED) {
        const intent = AdminIntentions.analyzeIntent(userMessage, message.member);
        
        if (intent && intent.type === 'send_message') {
          logger.info('⚙️ Intenção administrativa detectada', {
            type: intent.type,
            user: message.author.tag
          });

          const result = await AdminIntentions.processSendMessageIntent(
            intent,
            message.guild,
            message.member,
            message
          );

          if (!result.success) {
            await message.reply({
              content: `❌ ${result.error}`,
              allowedMentions: { repliedUser: false }
            });
            return;
          }

          // Gera preview
          const preview = AdminIntentions.generatePreview(
            result.message,
            result.channel.toString()
          );

          const confirmMsg = await message.reply({
            content: preview,
            allowedMentions: { repliedUser: false }
          });

          // Aguarda confirmação
          const confirmResponse = await new Promise(resolve => {
            const filter = m => m.author.id === message.author.id;
            let resolved = false;
            const collector = message.channel.createMessageCollector({
              filter,
              time: 30000,
              max: 1
            });

            collector.on('collect', m => {
              if (!resolved) {
                resolved = true;
                resolve(m);
              }
            });

            collector.on('end', () => {
              if (!resolved) {
                resolved = true;
                resolve(null);
              }
            });
          });

          if (!confirmResponse) {
            await message.followUp({
              content: '⏱️ Confirmação expirada. Cancelando.',
              allowedMentions: { repliedUser: false }
            });
            return;
          }

          if (!AdminIntentions.validateConfirmation(confirmResponse.content)) {
            await message.followUp({
              content: '❌ Confirmação negada. Cancelando.',
              allowedMentions: { repliedUser: false }
            });
            return;
          }

          // Envia a mensagem
          try {
            await result.channel.send({ content: result.message });
            await message.followUp({
              content: `✅ Mensagem enviada com sucesso em ${result.channel}!`,
              allowedMentions: { repliedUser: false }
            });

            logger.info('✉️ Mensagem administrativa enviada', {
              channel: result.channel.name,
              by: message.author.tag,
              messageLength: result.message.length
            });

            // Adiciona contexto da conversa
            contextManager.addMessage(
              message.author.id,
              message.guildId,
              'user',
              userMessage
            );
            contextManager.addMessage(
              message.author.id,
              message.guildId,
              'assistant',
              `Mensagem enviada com sucesso em ${result.channel}!`
            );
          } catch (error) {
            logger.error('❌ Erro ao enviar mensagem administrativa', {
              error: error.message
            });
            await message.followUp({
              content: '❌ Erro ao enviar mensagem. Verifique permissões.',
              allowedMentions: { repliedUser: false }
            });
          }
          return;
        }
      }

      // IA normal
      if (!config.FEATURES.AI_ENABLED) {
        return;
      }

      try {
        // Obtém contexto do usuário
        const context = contextManager.getContext(message.author.id, message.guildId);

        // Gera resposta
        const startTime = Date.now();
        const response = await gemini.generateResponse(userMessage, context);
        const responseTime = Date.now() - startTime;

        logger.info('✅ Resposta de IA gerada', {
          user: message.author.tag,
          responseTime: `${responseTime}ms`,
          responseLength: response.length
        });

        // Adiciona ao contexto
        contextManager.addMessage(
          message.author.id,
          message.guildId,
          'user',
          userMessage
        );
        contextManager.addMessage(
          message.author.id,
          message.guildId,
          'assistant',
          response
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

        if (error.message.includes('Chave de API')) {
          errorMsg = '❌ Erro de configuração: chave de API Gemini inválida.';
        } else if (error.message.includes('limite')) {
          errorMsg = '❌ Limite de requisições excedido. Tente novamente em alguns momentos.';
        } else if (error.message.includes('timeout')) {
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
