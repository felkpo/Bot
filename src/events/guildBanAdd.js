const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    const guild = ban.guild || ban;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === ban.user.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'MEMBER_BAN_ADD',
        executorId,
        targetId: ban.user.id,
        timestamp: new Date().toISOString()
      };

      if ('MEMBER_BAN_ADD'.includes('ROLE')) {
        eventData.roleId = ban.user.id;
      }
      if ('MEMBER_BAN_ADD'.includes('CHANNEL')) {
        eventData.channelId = ban.user.id;
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: 'MEMBER_BAN_ADD', executorId, targetId: ban.user.id });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria guildBanAdd', { error: error.message });
    }
  }
};
