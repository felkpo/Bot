const { AuditLogEvent } = require('discord.js');
const logger = require('../utils/logger');

class AuditManager {
  constructor() {
    this.cache = new Map();
  }

  async getRecentAuditLogs(guild, limit = 50) {
    try {
      const logs = await guild.fetchAuditLogs({ limit });
      return Array.from(logs.entries.values());
    } catch (error) {
      logger.error('Erro ao buscar audit logs recentes', { guildId: guild.id, error: error.message });
      return [];
    }
  }

  async getUserAuditHistory(guild, userId, limit = 50) {
    try {
      const logs = await guild.fetchAuditLogs({ limit: 100 });
      return Array.from(logs.entries.values())
        .filter(entry => entry.executorId === userId || entry.targetId === userId)
        .slice(0, limit);
    } catch (error) {
      logger.error('Erro ao buscar histórico de usuário no audit log', { guildId: guild.id, error: error.message });
      return [];
    }
  }

  async getRoleAuditHistory(guild, roleId, limit = 50) {
    try {
      const logs = await guild.fetchAuditLogs({ limit: 100 });
      return Array.from(logs.entries.values())
        .filter(entry => entry.targetId === roleId || (entry.extra && entry.extra.role?.id === roleId))
        .slice(0, limit);
    } catch (error) {
      logger.error('Erro ao buscar histórico de cargo no audit log', { guildId: guild.id, error: error.message });
      return [];
    }
  }

  async getChannelAuditHistory(guild, channelId, limit = 50) {
    try {
      const logs = await guild.fetchAuditLogs({ limit: 100 });
      return Array.from(logs.entries.values())
        .filter(entry => entry.targetId === channelId || (entry.extra && entry.extra.channel?.id === channelId))
        .slice(0, limit);
    } catch (error) {
      logger.error('Erro ao buscar histórico de canal no audit log', { guildId: guild.id, error: error.message });
      return [];
    }
  }

  async findRecentAction(guild, type, targetId, timeframeMs = 10000) {
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 10 });
      const entries = Array.from(logs.entries.values());
      
      const now = Date.now();
      for (const entry of entries) {
        if (entry.targetId === targetId && (now - entry.createdTimestamp) < timeframeMs) {
          return entry;
        }
      }
      return null;
    } catch (error) {
      logger.error('Erro ao buscar ação específica no audit log', { guildId: guild.id, error: error.message });
      return null;
    }
  }
}

module.exports = new AuditManager();