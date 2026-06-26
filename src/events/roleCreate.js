const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    const guild = role.guild || role;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === role.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'ROLE_CREATE',
        executorId,
        targetId: role.id,
        timestamp: new Date().toISOString()
      };

      if ('ROLE_CREATE'.includes('ROLE')) {
        eventData.roleId = role.id;
      }
      if ('ROLE_CREATE'.includes('CHANNEL')) {
        eventData.channelId = role.id;
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: 'ROLE_CREATE', executorId, targetId: role.id });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria roleCreate', { error: error.message });
    }
  }
};
