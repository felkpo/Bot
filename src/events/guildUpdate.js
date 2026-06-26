const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildUpdate,
  async execute(oldGuild, newGuild) {
    const guild = newGuild.guild || newGuild;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === newGuild.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'GUILD_UPDATE',
        executorId,
        targetId: newGuild.id,
        timestamp: new Date().toISOString()
      };

      if ('GUILD_UPDATE'.includes('ROLE')) {
        eventData.roleId = newGuild.id;
      }
      if ('GUILD_UPDATE'.includes('CHANNEL')) {
        eventData.channelId = newGuild.id;
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: 'GUILD_UPDATE', executorId, targetId: newGuild.id });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria guildUpdate', { error: error.message });
    }
  }
};
