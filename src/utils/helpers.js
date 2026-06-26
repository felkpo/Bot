const { PermissionFlagsBits, PermissionsBitField } = require('discord.js');

/**
 * Coleta uma única resposta de um usuário
 * @param {Channel} channel - Canal para coletar
 * @param {string} userId - ID do usuário
 * @param {number} time - Tempo limite em ms
 * @returns {Promise<Message|null>} - Mensagem ou null se timeout
 */
function collectResponse(channel, userId, time = 60000) {
  return new Promise(resolve => {
    const filter = m => m.author.id === userId;
    let resolved = false;
    const collector = channel.createMessageCollector({ filter, time, max: 1 });
    
    collector.on('collect', m => {
      if (!resolved) {
        resolved = true;
        resolve(m);
      }
    });
    
    collector.on('end', () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });
}

/**
 * Verifica se um usuário é administrador
 * @param {Member} member - Membro do servidor
 * @returns {boolean} - Se é admin
 */
function isAdmin(member) {
  return !!(member && member.permissions && member.permissions.has(PermissionsBitField.Flags.Administrator));
}

/**
 * Verifica se o bot tem permissão em um canal
 * @param {Channel} channel - Canal do Discord
 * @param {Client} client - Cliente do bot
 * @param {string} permission - Permissão a verificar (ex: SendMessages)
 * @returns {boolean} - Se tem permissão
 */
function botHasPermission(channel, client, permission = 'SendMessages') {
  const botMember = channel.guild?.members?.me;
  if (!botMember) return false;
  return botMember.permissionsIn(channel).has(PermissionFlagsBits[permission]);
}

/**
 * Encontra um canal por menção, ID ou nome
 * @param {Guild} guild - Servidor Discord
 * @param {string} input - Entrada do usuário
 * @param {Message} referencedMessage - Mensagem com menções
 * @returns {Channel|null} - Canal encontrado ou null
 */
function findChannel(guild, input, referencedMessage = null) {
  if (!guild) return null;
  
  // Verifica se há menção na mensagem anterior
  if (referencedMessage?.mentions?.channels?.size > 0) {
    return referencedMessage.mentions.channels.first();
  }
  
  const trimmed = input?.trim() || '';
  
  // Verifica ID
  if (/^\d+$/.test(trimmed)) {
    return guild.channels.cache.get(trimmed);
  }
  
  // Verifica nome (com ou sem #)
  const name = trimmed.replace(/^#/, '');
  return guild.channels.cache.find(ch => 
    ch.name === name && ch.isTextBased()
  );
}

/**
 * Sanitiza nome de emoji
 * @param {string} name - Nome a sanitizar
 * @returns {string} - Nome sanitizado
 */
function sanitizeEmojiName(name) {
  if (!name) return 'emoji';
  const s = name.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
  return s.slice(0, 32) || 'emoji';
}

/**
 * Obtém limite de emojis baseado no tier do servidor
 * @param {Guild} guild - Servidor Discord
 * @returns {number} - Limite de emojis
 */
function getEmojiLimit(guild) {
  const tier = guild?.premiumTier || 0;
  switch (tier) {
    case 3: return 250;
    case 2: return 150;
    case 1: return 100;
    default: return 50;
  }
}

/**
 * Formata tempo em ms para string legível
 * @param {number} ms - Tempo em milissegundos
 * @returns {string} - Tempo formatado
 */
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Universal target resolver
 * @param {Guild} guild - The Discord guild
 * @param {string} input - The input string (ID, mention, or name)
 * @param {string} type - 'user', 'role', 'channel', or 'bot'
 * @returns {Object|null} - Resolved object with id and name, or null
 */
async function resolveTarget(guild, input, type) {
  if (!guild || !input) return null;
  const strInput = String(input).trim();
  
  // Extract ID if mention
  let id = strInput.replace(/<@!?&?#?(\d+)>/, '$1');
  let isId = /^\d{17,20}$/.test(id);

  if (type === 'user' || type === 'bot') {
    if (isId) {
      try {
        const user = await guild.client.users.fetch(id);
        if (user && type === 'bot' && !user.bot) return null;
        if (user) return { id: user.id, name: user.username, isBot: user.bot };
      } catch (e) {
        const logger = require('./logger');
        logger.error('[AUDIT BOT LOOKUP ERROR]', { error: e.message, target: id });
      }
    }
    
    // Search by name ONLY in cache (NEVER global fetch)
    const lowerInput = strInput.toLowerCase();
    let found;
    if (type === 'bot') {
      found = guild.members.cache.find(m => m.user.bot && (m.user.username.toLowerCase() === lowerInput || m.user.globalName?.toLowerCase() === lowerInput));
      if (!found) {
        found = guild.members.cache.find(m => m.user.bot && (m.user.username.toLowerCase().includes(lowerInput) || m.user.globalName?.toLowerCase().includes(lowerInput)));
      }
    } else {
      found = guild.members.cache.find(m => m.user.username.toLowerCase() === lowerInput || m.user.globalName?.toLowerCase() === lowerInput);
      if (!found) {
        found = guild.members.cache.find(m => m.user.username.toLowerCase().includes(lowerInput) || m.user.globalName?.toLowerCase().includes(lowerInput));
      }
    }
    if (found) return { id: found.id, name: found.user.username, isBot: found.user.bot };
  } 
  else if (type === 'role') {
    if (isId) {
      const role = guild.roles.cache.get(id);
      if (role) return { id: role.id, name: role.name };
    }
    
    const lowerInput = strInput.toLowerCase();
    let found = guild.roles.cache.find(r => r.name.toLowerCase() === lowerInput);
    if (!found) {
      found = guild.roles.cache.find(r => r.name.toLowerCase().includes(lowerInput));
    }
    if (found) return { id: found.id, name: found.name };
  }
  else if (type === 'channel') {
    if (isId) {
      const channel = guild.channels.cache.get(id);
      if (channel) return { id: channel.id, name: channel.name };
    }
    
    const lowerInput = strInput.toLowerCase().replace(/^#/, '');
    let found = guild.channels.cache.find(c => c.name.toLowerCase() === lowerInput);
    if (!found) {
      found = guild.channels.cache.find(c => c.name.toLowerCase().includes(lowerInput));
    }
    if (found) return { id: found.id, name: found.name };
  }

  return null;
}

module.exports = {
  collectResponse,
  isAdmin,
  botHasPermission,
  findChannel,
  sanitizeEmojiName,
  getEmojiLimit,
  formatTime,
  resolveTarget
};
