const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    const guild = newRole.guild || newRole;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === newRole.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'ROLE_UPDATE',
        executorId,
        targetId: newRole.id,
        timestamp: new Date().toISOString()
      };

      if ('ROLE_UPDATE'.includes('ROLE')) {
        eventData.roleId = newRole.id;
      }
      if ('ROLE_UPDATE'.includes('CHANNEL')) {
        eventData.channelId = newRole.id;
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: 'ROLE_UPDATE', executorId, targetId: newRole.id });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria roleUpdate', { error: error.message });
    }
  }
};
