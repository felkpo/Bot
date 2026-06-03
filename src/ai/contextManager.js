const config = require('../config/config');
const logger = require('../utils/logger');

class ContextManager {
  constructor() {
    this.userContexts = new Map();
    this.cooldowns = new Map();
  }

  /**
   * Obtém o contexto de um usuário
   * @param {string} userId - ID do usuário
   * @param {string} guildId - ID do servidor
   * @returns {Array} - Histórico de mensagens
   */
  getContext(userId, guildId) {
    const key = `${guildId}-${userId}`;
    if (!this.userContexts.has(key)) {
      this.userContexts.set(key, []);
    }
    return this.userContexts.get(key);
  }

  /**
   * Adiciona uma mensagem ao contexto
   * @param {string} userId - ID do usuário
   * @param {string} guildId - ID do servidor
   * @param {string} role - 'user' ou 'assistant'
   * @param {string} content - Conteúdo da mensagem
   */
  addMessage(userId, guildId, role, content) {
    const key = `${guildId}-${userId}`;
    const context = this.getContext(userId, guildId);
    
    context.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Limita o histórico
    if (context.length > config.AI.maxHistoryPerUser) {
      context.shift();
    }

    logger.debug('📝 Mensagem adicionada ao contexto', {
      userId,
      role,
      contextSize: context.length
    });
  }

  /**
   * Limpa o contexto de um usuário
   * @param {string} userId - ID do usuário
   * @param {string} guildId - ID do servidor
   */
  clearContext(userId, guildId) {
    const key = `${guildId}-${userId}`;
    this.userContexts.delete(key);
    logger.debug('🗑️ Contexto do usuário limpo', { userId });
  }

  /**
   * Verifica cooldown do usuário
   * @param {string} userId - ID do usuário
   * @returns {boolean} - Se está em cooldown
   */
  isOnCooldown(userId) {
    if (!config.FEATURES.COOLDOWN_ENABLED) return false;

    const now = Date.now();
    const cooldownTime = this.cooldowns.get(userId);

    if (cooldownTime && now < cooldownTime) {
      return true;
    }

    this.cooldowns.set(userId, now + config.AI.cooldownMs);
    return false;
  }

  /**
   * Obtém tempo restante de cooldown
   * @param {string} userId - ID do usuário
   * @returns {number} - Tempo em ms
   */
  getCooldownTimeRemaining(userId) {
    const cooldownTime = this.cooldowns.get(userId);
    if (!cooldownTime) return 0;

    const now = Date.now();
    const remaining = cooldownTime - now;
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Limpa cooldowns antigos (limpeza periódica)
   */
  cleanupCooldowns() {
    const now = Date.now();
    for (const [userId, cooldownTime] of this.cooldowns.entries()) {
      if (now > cooldownTime) {
        this.cooldowns.delete(userId);
      }
    }
  }

  /**
   * Obtém estatísticas do gerenciador
   * @returns {Object} - Estatísticas
   */
  getStats() {
    return {
      totalContexts: this.userContexts.size,
      totalCooldowns: this.cooldowns.size,
      totalMessages: Array.from(this.userContexts.values()).reduce(
        (sum, ctx) => sum + ctx.length, 0
      )
    };
  }
}

// Cleanup periódico de cooldowns (a cada 5 minutos)
setInterval(() => {
  const manager = ContextManager.instance || contextManager;
  manager.cleanupCooldowns();
}, 5 * 60 * 1000);

const contextManager = new ContextManager();
module.exports = contextManager;
