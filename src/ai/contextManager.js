const path = require('path');
const sqlite = require('../db/sqlite');
const config = require('../config/config');
const logger = require('../utils/logger');

const USER_HISTORY_LIMIT = config.AI.maxHistoryPerUser || 10;
const CHANNEL_HISTORY_LIMIT = 20;

class ContextManager {
  constructor() {
    this.userContexts = new Map();
    this.cooldowns = new Map();
  }

  async upsertUser(userId, guildId, username) {
    const now = Date.now();
    const existing = await sqlite.get(
      'SELECT * FROM users WHERE user_id = ? AND guild_id = ?',
      [userId, guildId]
    );

    if (existing) {
      await sqlite.run(
        'UPDATE users SET username = ?, last_seen = ? WHERE user_id = ? AND guild_id = ?',
        [username, now, userId, guildId]
      );
    } else {
      await sqlite.run(
        'INSERT INTO users (user_id, guild_id, username, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)',
        [userId, guildId, username, now, now]
      );
    }
  }

  async upsertChannel(channelId, guildId, name, newMessage) {
    const existing = await sqlite.get('SELECT * FROM channels WHERE channel_id = ?', [channelId]);
    let lastMessages = [];

    if (existing && existing.last_messages) {
      try {
        lastMessages = JSON.parse(existing.last_messages);
      } catch (error) {
        lastMessages = [];
      }
    }

    lastMessages.push(newMessage);
    if (lastMessages.length > CHANNEL_HISTORY_LIMIT) {
      lastMessages = lastMessages.slice(-CHANNEL_HISTORY_LIMIT);
    }

    const serialized = JSON.stringify(lastMessages);
    const now = Date.now();

    if (existing) {
      await sqlite.run(
        'UPDATE channels SET name = ?, last_messages = ?, updated_at = ? WHERE channel_id = ?',
        [name, serialized, now, channelId]
      );
    } else {
      await sqlite.run(
        'INSERT INTO channels (channel_id, guild_id, name, last_messages, updated_at) VALUES (?, ?, ?, ?, ?)',
        [channelId, guildId, name, serialized, now]
      );
    }
  }

  async storeUserFact(userId, guildId, key, value, source = 'message') {
    const now = Date.now();
    const existing = await sqlite.get(
      'SELECT * FROM memories WHERE guild_id = ? AND user_id = ? AND type = ? AND key = ?',
      [guildId, userId, 'fact', key]
    );

    if (existing) {
      await sqlite.run(
        'UPDATE memories SET value = ?, source = ?, relevance = relevance + 1, updated_at = ? WHERE id = ?',
        [value, source, now, existing.id]
      );
    } else {
      await sqlite.run(
        'INSERT INTO memories (guild_id, user_id, type, key, value, source, relevance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [guildId, userId, 'fact', key, value, source, 1, now, now]
      );
    }

    logger.info('🧠 Fato de usuário armazenado', { userId, key, value });
  }

  async storeEvent(guildId, eventType, title, description, metadata = {}) {
    const now = Date.now();
    await sqlite.run(
      'INSERT INTO events (guild_id, event_type, title, description, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [guildId, eventType, title, description, JSON.stringify(metadata), now]
    );

    await this.updateServerSummary(guildId);
    logger.info('📌 Evento registrado no servidor', { guildId, eventType, title });
  }

  async logAuditAction(guildId, action, actorId, actorTag, targetId, targetTag, reason, channelId, metadata = {}) {
    const now = Date.now();
    await sqlite.run(
      'INSERT INTO audits (guild_id, action, actor_id, actor_tag, target_id, target_tag, reason, channel_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [guildId, action, actorId, actorTag, targetId, targetTag, reason, channelId, JSON.stringify(metadata), now]
    );

    logger.info('🛡️ Ação administrativa registrada', {
      guildId,
      action,
      actorTag,
      targetTag,
      channelId,
      reason
    });
  }

  async updateChannelSummary(channelId, guildId) {
    const channelRow = await sqlite.get('SELECT * FROM channels WHERE channel_id = ?', [channelId]);
    if (!channelRow || !channelRow.last_messages) return;

    let messages = [];
    try {
      messages = JSON.parse(channelRow.last_messages);
    } catch (error) {
      messages = [];
    }

    const summary = this.createChannelSummary(messages);
    const now = Date.now();

    await sqlite.run(
      'INSERT INTO summaries (guild_id, channel_id, summary_type, content, updated_at) VALUES (?, ?, ?, ?, ?)',
      [guildId, channelId, 'channel', summary, now]
    );

    await this.updateServerSummary(guildId);
  }

  async updateServerSummary(guildId) {
    const channelSummaries = await sqlite.all(
      'SELECT content FROM summaries WHERE guild_id = ? AND summary_type = ?',
      [guildId, 'channel']
    );

    const eventRows = await sqlite.all('SELECT * FROM events WHERE guild_id = ? ORDER BY created_at DESC LIMIT 5', [guildId]);
    const eventSummary = eventRows.map(event => `• [${event.event_type}] ${event.title}`).join('\n');
    const channelSummaryText = channelSummaries.map(row => row.content).join('\n');

    const serverSummary = `Resumo do servidor:
${eventSummary || 'Sem eventos recentes.'}
${channelSummaryText ? `\nTópicos recentes: ${channelSummaryText}` : ''}`;
    const now = Date.now();

    await sqlite.run(
      'INSERT INTO summaries (guild_id, channel_id, summary_type, content, updated_at) VALUES (?, NULL, ?, ?, ?)',
      [guildId, 'server', serverSummary, now]
    );
  }

  createChannelSummary(messages) {
    if (!messages.length) return 'Não há histórico recente no canal.';

    const uniqueAuthors = [...new Set(messages.map(msg => msg.author))].slice(0, 3);
    const recentTopics = messages
      .map(msg => msg.content.toLowerCase())
      .filter(Boolean)
      .slice(-10)
      .join(' ');

    const keywords = [];
    ['aviso', 'evento', 'comunicado', 'anúncio', 'atualização', 'discord', 'jogo', 'tópico', 'convite'].forEach(word => {
      if (recentTopics.includes(word)) {
        keywords.push(word);
      }
    });

    const topicText = keywords.length ? `Principais tópicos: ${[...new Set(keywords)].join(', ')}.` : 'Sem tópicos específicos detectados recentemente.';
    return `Últimas mensagens por ${uniqueAuthors.join(', ')}. ${topicText}`;
  }

  async getUserFacts(userId, guildId) {
    return sqlite.all(
      'SELECT key, value FROM memories WHERE guild_id = ? AND user_id = ? AND type = ? ORDER BY relevance DESC',
      [guildId, userId, 'fact']
    );
  }

  async getUserMemorySummary(userId, guildId) {
    const facts = await this.getUserFacts(userId, guildId);
    if (!facts.length) return '';

    return facts
      .slice(0, 5)
      .map(fact => `Você comentou anteriormente que seu ${fact.key} é ${fact.value}.`)
      .join(' ');
  }

  async getChannelMemorySummary(channelId) {
    const summaryRow = await sqlite.get(
      'SELECT content FROM summaries WHERE channel_id = ? AND summary_type = ?',
      [channelId, 'channel']
    );
    return summaryRow?.content || '';
  }

  async getServerMemorySummary(guildId) {
    const summaryRow = await sqlite.get(
      'SELECT content FROM summaries WHERE guild_id = ? AND summary_type = ? ORDER BY updated_at DESC LIMIT 1',
      [guildId, 'server']
    );
    return summaryRow?.content || '';
  }

  getContext(userId, guildId) {
    const key = `${guildId}-${userId}`;
    if (!this.userContexts.has(key)) {
      this.userContexts.set(key, []);
    }
    return this.userContexts.get(key);
  }

  async addMessage(userId, guildId, role, content, channelId, channelName, authorTag) {
    const key = `${guildId}-${userId}`;
    const context = this.getContext(userId, guildId);

    context.push({
      role,
      content,
      timestamp: Date.now()
    });

    if (context.length > USER_HISTORY_LIMIT) {
      context.shift();
    }

    logger.debug('📝 Mensagem adicionada ao contexto', {
      userId,
      role,
      contextSize: context.length
    });

    if (role === 'user') {
      await this.upsertUser(userId, guildId, authorTag);
      await this.rememberUserFacts(userId, guildId, content);
      await this.upsertChannel(channelId, guildId, channelName, {
        author: authorTag,
        content,
        timestamp: Date.now()
      });

      if (this.shouldRegisterServerEvent(content)) {
        const eventData = this.extractEventData(content);
        if (eventData) {
          await this.storeEvent(guildId, eventData.type, eventData.title, eventData.description, {
            channelId,
            channelName
          });
        }
      }

      await this.updateChannelSummary(channelId, guildId);
    } else if (role === 'assistant') {
      await this.upsertChannel(channelId, guildId, channelName, {
        author: config.BOT_NAME,
        content,
        timestamp: Date.now()
      });
    }
  }

  async getPromptContext(userId, guildId, channelId) {
    const history = this.getContext(userId, guildId).slice(-USER_HISTORY_LIMIT);
    const userMemory = await this.getUserMemorySummary(userId, guildId);
    const channelMemory = await this.getChannelMemorySummary(channelId);
    const serverMemory = await this.getServerMemorySummary(guildId);

    return {
      history,
      userMemory,
      channelMemory,
      serverMemory
    };
  }

  shouldRegisterServerEvent(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    return /aviso|anúncio|anuncio|comunicado|evento|atualização|atualizacao|lançamento|update/.test(lower);
  }

  rememberUserFacts(userId, guildId, content) {
    const fact = this.extractPersonalFact(content);
    if (!fact) return Promise.resolve();
    return this.storeUserFact(userId, guildId, fact.key, fact.value);
  }

  extractPersonalFact(content) {
    if (!content) return null;
    const normalized = content.replace(/[?.!]/g, '').trim();
    const factPattern = /(?:meu|minha|meus|minhas)\s+([\wà-úçãõéíóú\s]{2,40})\s+é\s+(.+)/i;
    const match = normalized.match(factPattern);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        return { key, value };
      }
    }
    return null;
  }

  extractEventData(content) {
    if (!content) return null;
    const lower = content.toLowerCase();
    const eventType = /aviso/.test(lower)
      ? 'aviso'
      : /anúncio|anuncio|comunicado/.test(lower)
      ? 'comunicado'
      : /evento/.test(lower)
      ? 'evento'
      : /atualização|atualizacao|update/.test(lower)
      ? 'atualizacao'
      : null;

    if (!eventType) return null;

    const titlePattern = /(?:aviso|anúncio|anuncio|comunicado|evento|atualização|atualizacao).{0,30}/i;
    const titleMatch = content.match(titlePattern);
    const title = titleMatch ? titleMatch[0].trim() : `Novo ${eventType}`;
    const description = content.substring(title.length).trim() || content.trim();

    return { type: eventType, title, description };
  }

  async clearContext(userId, guildId) {
    const key = `${guildId}-${userId}`;
    this.userContexts.delete(key);
    logger.debug('🗑️ Contexto do usuário limpo', { userId });
  }

  isOnCooldown(userId) {
    if (!config.FEATURES.COOLDOWN_ENABLED) return false;
    const now = Date.now();
    const cooldownTime = this.cooldowns.get(userId);
    if (cooldownTime && now < cooldownTime) {
      return true;
    }
    this.cooldowns.set(userId, now + config.AI.cooldownMs);
    return false;
  }

  getCooldownTimeRemaining(userId) {
    const cooldownTime = this.cooldowns.get(userId);
    if (!cooldownTime) return 0;
    const now = Date.now();
    const remaining = cooldownTime - now;
    return remaining > 0 ? remaining : 0;
  }

  cleanupCooldowns() {
    const now = Date.now();
    for (const [userId, cooldownTime] of this.cooldowns.entries()) {
      if (now > cooldownTime) {
        this.cooldowns.delete(userId);
      }
    }
  }

  getStats() {
    return {
      totalContexts: this.userContexts.size,
      totalCooldowns: this.cooldowns.size,
      totalMessages: Array.from(this.userContexts.values()).reduce((sum, ctx) => sum + ctx.length, 0)
    };
  }
}

const contextManager = new ContextManager();

setInterval(() => {
  contextManager.cleanupCooldowns();
}, 5 * 60 * 1000);

module.exports = contextManager;
