const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class AuditMemoryManager {
  constructor() {
    this.filePath = path.join(__dirname, '..', '..', 'data', 'audit-history.json');
    this.memory = {};
    this.loadMemory();
  }

  loadMemory() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.memory = JSON.parse(data);
      } else {
        this.memory = {};
        this.saveMemory();
      }
    } catch (error) {
      logger.error('Erro ao carregar memória de auditoria', { error: error.message });
      this.memory = {};
    }
  }

  saveMemory() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2));
    } catch (error) {
      logger.error('Erro ao salvar memória de auditoria', { error: error.message });
    }
  }

  addEvent(guildId, eventData) {
    if (!this.memory[guildId]) {
      this.memory[guildId] = { events: [] };
    }
    
    this.memory[guildId].events.unshift(eventData);
    
    // Limitar o histórico local para evitar que o arquivo cresça infinitamente
    if (this.memory[guildId].events.length > 5000) {
      this.memory[guildId].events = this.memory[guildId].events.slice(0, 5000);
    }
    
    this.saveMemory();
    logger.info('[AUDIT MEMORY SAVE]', { action: eventData.action, timestamp: eventData.timestamp });
  }

  getRecentEvents(guildId, limit = 50) {
    if (!this.memory[guildId]) return [];
    return this.memory[guildId].events.slice(0, limit);
  }

  getUserEvents(guildId, userId, limit = 50) {
    if (!this.memory[guildId]) return [];
    return this.memory[guildId].events
      .filter(e => e.executorId === userId || e.targetId === userId || e.requestedBy === userId)
      .slice(0, limit);
  }

  getRoleEvents(guildId, roleId, limit = 50) {
    if (!this.memory[guildId]) return [];
    return this.memory[guildId].events
      .filter(e => e.roleId === roleId || e.targetId === roleId)
      .slice(0, limit);
  }

  getChannelEvents(guildId, channelId, limit = 50) {
    if (!this.memory[guildId]) return [];
    return this.memory[guildId].events
      .filter(e => e.channelId === channelId || e.targetId === channelId)
      .slice(0, limit);
  }

  getBotEvents(guildId, botId = null, limit = 50) {
    if (!this.memory[guildId]) return [];
    return this.memory[guildId].events
      .filter(e => e.action === 'BOT_ADD' && (!botId || e.targetBotId === botId))
      .slice(0, limit);
  }

  getEventsByTimeframe(guildId, timeframeHours) {
    if (!this.memory[guildId]) return [];
    const now = Date.now();
    const timeframeMs = timeframeHours * 60 * 60 * 1000;
    return this.memory[guildId].events.filter(e => {
      const eventTime = new Date(e.timestamp).getTime();
      return (now - eventTime) <= timeframeMs;
    });
  }

  getAllEvents(guildId) {
    if (!this.memory[guildId]) return [];
    return this.memory[guildId].events;
  }
}

module.exports = new AuditMemoryManager();