const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    const guild = channel.guild || channel;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === channel.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'CHANNEL_DELETE',
        executorId,
        targetId: channel.id,
        timestamp: new Date().toISOString()
      };

      if ('CHANNEL_DELETE'.includes('ROLE')) {
        eventData.roleId = channel.id;
      }
      if ('CHANNEL_DELETE'.includes('CHANNEL')) {
        eventData.channelId = channel.id;
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: 'CHANNEL_DELETE', executorId, targetId: channel.id });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria channelDelete', { error: error.message });
    }
  }
};
