const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { findChannel, botHasPermission, isAdmin } = require('../utils/helpers');

class AdminIntentions {
  /**
   * Analisa mensagem para intenções administrativas
   * @param {string} message - Conteúdo da mensagem
   * @param {Member} member - Membro que enviou
   * @returns {Object|null} - Intenção detectada ou null
   */
  static analyzeIntent(message, member) {
    if (!isAdmin(member)) return null;

    const lowerMessage = message.toLowerCase();

    // Padrão: "envie/mande/publique [mensagem] no/em canal [name/mention]"
    const sendPatterns = [
      /(?:envie|mande|publique)\s+(.+?)\s+(?:no|em)\s+canal\s+(.+)/i,
      /(?:envie|mande|publique)\s+(.+?)\s+(?:no|em)\s+<#(\d+)>/i
    ];

    for (const pattern of sendPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'send_message',
          messageContent: match[1].trim(),
          channelTarget: match[2].trim(),
          rawMessage: message
        };
      }
    }

    return null;
  }

  /**
   * Processa intenção de enviar mensagem
   * @param {Object} intent - Intenção detectada
   * @param {Guild} guild - Servidor Discord
   * @param {Member} member - Membro que solicitou
   * @param {Message} referencedMessage - Mensagem anterior (para menções)
   * @returns {Promise<Object>} - Resultado do processamento
   */
  static async processSendMessageIntent(intent, guild, member, referencedMessage) {
    try {
      // Verifica admin
      if (!isAdmin(member)) {
        return {
          success: false,
          error: 'Apenas administradores podem usar este comando.'
        };
      }

      // Encontra o canal
      const channel = findChannel(guild, intent.channelTarget, referencedMessage);
      if (!channel || !channel.isTextBased()) {
        return {
          success: false,
          error: `Canal não encontrado: ${intent.channelTarget}`
        };
      }

      // Verifica permissão do bot
      const botMember = guild.members.me;
      if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        return {
          success: false,
          error: `Não tenho permissão para enviar mensagens em ${channel.name}`
        };
      }

      return {
        success: true,
        channel,
        message: intent.messageContent,
        confirmed: false
      };
    } catch (error) {
      logger.error('❌ Erro ao processar intenção admin', { error: error.message });
      return {
        success: false,
        error: 'Erro ao processar intenção'
      };
    }
  }

  /**
   * Gera preview da mensagem
   * @param {string} messageContent - Conteúdo da mensagem
   * @param {Channel} channel - Canal de destino
   * @returns {string} - Preview formatado
   */
  static generatePreview(messageContent, channel) {
    const preview = messageContent
      .substring(0, 200)
      .replace(/<@!?\d+>/g, '@user')
      .replace(/<#\d+>/g, '#canal');
    
    const hasMore = messageContent.length > 200 ? '\n\n*... (mensagem truncada no preview)*' : '';
    
    return `Você deseja enviar a seguinte mensagem no canal ${channel}?\n\n📝 ${preview}${hasMore}\n\nResponda **SIM** para confirmar.`;
  }

  /**
   * Valida resposta de confirmação
   * @param {string} response - Resposta do usuário
   * @returns {boolean} - Se confirmou
   */
  static validateConfirmation(response) {
    const confirmed = ['sim', 's', 'yes', 'y', 'confirmar'].includes(
      response.toLowerCase().trim()
    );
    return confirmed;
  }
}

module.exports = AdminIntentions;
