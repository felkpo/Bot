const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    const guild = newMember.guild || newMember;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === newMember.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'MEMBER_UPDATE',
        executorId,
        targetId: newMember.id,
        timestamp: new Date().toISOString()
      };

      if ('MEMBER_UPDATE'.includes('ROLE')) {
        eventData.roleId = newMember.id;
      }
      if ('MEMBER_UPDATE'.includes('CHANNEL')) {
        eventData.channelId = newMember.id;
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: 'MEMBER_UPDATE', executorId, targetId: newMember.id });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria guildMemberUpdate', { error: error.message });
    }
  }
};
