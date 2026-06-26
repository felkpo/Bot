const fs = require('fs');
const path = require('path');

const events = [
  { name: 'GuildBanAdd', eventName: 'guildBanAdd', args: 'ban', targetId: 'ban.user.id', action: 'MEMBER_BAN_ADD' },
  { name: 'GuildBanRemove', eventName: 'guildBanRemove', args: 'ban', targetId: 'ban.user.id', action: 'MEMBER_BAN_REMOVE' },
  { name: 'GuildMemberUpdate', eventName: 'guildMemberUpdate', args: 'oldMember, newMember', targetId: 'newMember.id', action: 'MEMBER_UPDATE' },
  { name: 'ChannelCreate', eventName: 'channelCreate', args: 'channel', targetId: 'channel.id', action: 'CHANNEL_CREATE' },
  { name: 'ChannelDelete', eventName: 'channelDelete', args: 'channel', targetId: 'channel.id', action: 'CHANNEL_DELETE' },
  { name: 'ChannelUpdate', eventName: 'channelUpdate', args: 'oldChannel, newChannel', targetId: 'newChannel.id', action: 'CHANNEL_UPDATE' },
  { name: 'GuildRoleCreate', eventName: 'roleCreate', args: 'role', targetId: 'role.id', action: 'ROLE_CREATE' },
  { name: 'GuildRoleDelete', eventName: 'roleDelete', args: 'role', targetId: 'role.id', action: 'ROLE_DELETE' },
  { name: 'GuildRoleUpdate', eventName: 'roleUpdate', args: 'oldRole, newRole', targetId: 'newRole.id', action: 'ROLE_UPDATE' },
  { name: 'GuildUpdate', eventName: 'guildUpdate', args: 'oldGuild, newGuild', targetId: 'newGuild.id', action: 'GUILD_UPDATE' }
];

events.forEach(e => {
  const content = `const { Events, AuditLogEvent } = require('discord.js');
const auditMemoryManager = require('../managers/auditMemoryManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.${e.name},
  async execute(${e.args}) {
    const guild = ${e.args.includes(',') ? e.args.split(', ')[1] + '.guild' : e.args + '.guild'} || ${e.args.includes(',') ? e.args.split(', ')[1] : e.args};
    if (!guild || !guild.id) return;

    try {
      await new Promise(r => setTimeout(r, 1500));
      const logs = await guild.fetchAuditLogs({ limit: 10 });
      const entries = Array.from(logs.entries.values());
      const now = Date.now();
      
      let foundEntry = null;
      for (const entry of entries) {
        if (entry.targetId === ${e.targetId} && (now - entry.createdTimestamp) < 15000) {
          foundEntry = entry;
          break;
        }
      }

      const executorId = foundEntry ? foundEntry.executorId : 'Desconhecido';
      
      const eventData = {
        action: '${e.action}',
        executorId,
        targetId: ${e.targetId},
        timestamp: new Date().toISOString()
      };

      if ('${e.action}'.includes('ROLE')) {
        eventData.roleId = ${e.targetId};
      }
      if ('${e.action}'.includes('CHANNEL')) {
        eventData.channelId = ${e.targetId};
      }

      auditMemoryManager.addEvent(guild.id, eventData);
      logger.info('[AUDIT EVENT DETECTED]', { action: '${e.action}', executorId, targetId: ${e.targetId} });

    } catch (error) {
      logger.error('Erro ao processar evento de auditoria ${e.eventName}', { error: error.message });
    }
  }
};
`;
  fs.writeFileSync(path.join('src', 'events', e.eventName + '.js'), content);
});
console.log('Event files created.');