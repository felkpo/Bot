const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (!member.user.bot) return; // Só queremos auditar adição de bots

    const guild = member.guild;
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ type: 28, limit: 10 }); // 28 é BOT_ADD
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === member.user.id && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: 'BOT_ADD',
        executorId,
        targetBotId: member.user.id,
        targetBotName: member.user.username,
        timestamp: new Date().toISOString()
      };

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT BOT ADD]', { botId: member.user.id, botName: member.user.username, executorId });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria BOT_ADD', { error: error.message });
    }
  }
};