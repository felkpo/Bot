const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const contextManager = require('../managers/contextManager');
const guildSettingsManager = require('../managers/guildSettingsManager');
const config = require('../config/config');
const { collectResponse, isAdmin, botHasPermission, findChannel } = require('../utils/helpers');

const ACTION_ALIASES = {
  // === send_message ===
  sendmessage: 'send_message',
  send_message: 'send_message',
  send: 'send_message',
  message: 'send_message',
  reply: 'send_message',
  respond: 'send_message',
  answer: 'send_message',
  enviar: 'send_message',
  enviarmensagem: 'send_message',
  enviar_mensagem: 'send_message',

  // === create_embed ===
  createembed: 'create_embed',
  create_embed: 'create_embed',
  anuncio: 'create_embed',
  comunicado: 'create_embed',
  evento: 'create_embed',
  atualizacao: 'create_embed',
  atualização: 'create_embed',
  aviso: 'create_embed',
  send_embed: 'create_embed',
  embed: 'create_embed',
  criar_embed: 'create_embed',
  criarembed: 'create_embed',

  // === ban_user ===
  ban: 'ban_user',
  banir: 'ban_user',
  ban_user: 'ban_user',
  ban_member: 'ban_user',
  banimento: 'ban_user',
  banir_usuario: 'ban_user',

  // === unban_user ===
  unban: 'unban_user',
  desban: 'unban_user',
  desbanir: 'unban_user',
  remove_ban: 'unban_user',
  removeban: 'unban_user',
  remover_ban: 'unban_user',
  removerban: 'unban_user',
  retira_ban: 'unban_user',
  retiraban: 'unban_user',
  retirar_ban: 'unban_user',
  retirarban: 'unban_user',
  unban_user: 'unban_user',

  // === kick_user ===
  kick: 'kick_user',
  expulsar: 'kick_user',
  kick_user: 'kick_user',
  kick_member: 'kick_user',
  expulsao: 'kick_user',
  expulsar_usuario: 'kick_user',

  // === timeout_user ===
  timeout: 'timeout_user',
  silenciar: 'timeout_user',
  mute: 'timeout_user',
  mute_user: 'timeout_user',
  timeout_user: 'timeout_user',
  timeout_member: 'timeout_user',
  silenciar_usuario: 'timeout_user',

  // === untimeout_user ===
  untimeout: 'untimeout_user',
  untimeout_user: 'untimeout_user',
  removetimeout: 'untimeout_user',
  remove_timeout: 'untimeout_user',
  removertimeout: 'untimeout_user',
  remover_timeout: 'untimeout_user',
  retiratimeout: 'untimeout_user',
  retira_timeout: 'untimeout_user',
  retirartimeout: 'untimeout_user',
  retirar_timeout: 'untimeout_user',
  unmute: 'untimeout_user',
  unmute_user: 'untimeout_user',
  desmutar: 'untimeout_user',
  removemute: 'untimeout_user',
  remove_mute: 'remove_warning', // Corrigido alias que apontava para remove_warning
  removermute: 'untimeout_user',
  remover_mute: 'untimeout_user',
  retiramute: 'untimeout_user',
  retira_mute: 'untimeout_user',
  desilenciar: 'untimeout_user',
  remover_silencio: 'untimeout_user',

  // === warn_user ===
  warning: 'warn_user',
  warn: 'warn_user',
  advertir: 'warn_user',
  warn_user: 'warn_user',
  advertencia: 'warn_user',
  advertir_usuario: 'warn_user',

  // === remove_warning ===
  remove_warning: 'remove_warning',
  removeradvertencia: 'remove_warning',
  unwarn: 'remove_warning',
  remover_advertencia: 'remove_warning',

  // === purge_messages ===
  purge: 'purge_messages',
  purge_messages: 'purge_messages',
  bulk_delete: 'purge_messages',
  delete_messages: 'purge_messages',
  delete_message: 'purge_messages',
  remove_messages: 'purge_messages',
  clear_messages: 'purge_messages',
  'apagar mensagens': 'purge_messages',
  'limpar mensagens': 'purge_messages',
  apagar: 'purge_messages',
  limpar: 'purge_messages',

  // === lock_channel ===
  lock: 'lock_channel',
  trancar: 'lock_channel',
  lock_channel: 'lock_channel',
  trancar_canal: 'lock_channel',

  // === unlock_channel ===
  unlock: 'unlock_channel',
  destrancar: 'unlock_channel',
  unlock_channel: 'unlock_channel',
  destrancar_canal: 'unlock_channel',

  // === create_channel ===
  createchannel: 'create_channel',
  create_channel: 'create_channel',
  criarchannel: 'create_channel',
  criarcanal: 'create_channel',
  criar_canal: 'create_channel',
  cria_canal: 'create_channel',
  criacanal: 'create_channel',
  novocanal: 'create_channel',
  novo_canal: 'create_channel',
  newchannel: 'create_channel',

  // === delete_channel ===
  deletechannel: 'delete_channel',
  delete_channel: 'delete_channel',
  deletarcanal: 'delete_channel',
  deletar_canal: 'delete_channel',
  excluircanal: 'delete_channel',
  excluir_canal: 'delete_channel',
  removercanal: 'delete_channel',
  apagar_canal: 'delete_channel',
  apagarcanal: 'delete_channel',

  // === rename_channel ===
  renamechannel: 'rename_channel',
  rename_channel: 'rename_channel',
  renomearcanal: 'rename_channel',
  renomear_canal: 'rename_channel',
  renamecanal: 'rename_channel',

  // === move_channel ===
  movechannel: 'move_channel',
  move_channel: 'move_channel',
  movercanal: 'move_channel',

  // === clone_channel ===
  clonechannel: 'clone_channel',
  clone_channel: 'clone_channel',
  clonarcanal: 'clone_channel',

  // === create_category ===
  createcategory: 'create_category',
  create_category: 'create_category',
  criarcategoria: 'create_category',
  criar_categoria: 'create_category',

  // === delete_category ===
  deletecategory: 'delete_category',
  delete_category: 'delete_category',
  deletarcategoria: 'delete_category',
  excluircategoria: 'delete_category',

  // === rename_category ===
  renamecategory: 'rename_category',
  rename_category: 'rename_category',
  renomearcategoria: 'rename_category',

  // === create_role ===
  createrole: 'create_role',
  create_role: 'create_role',
  criarcargo: 'create_role',
  criar_cargo: 'create_role',
  novocargo: 'create_role',

  // === delete_role ===
  deleterole: 'delete_role',
  delete_role: 'delete_role',
  deletarcargo: 'delete_role',
  excluircargo: 'delete_role',

  // === rename_role ===
  renamerole: 'rename_role',
  rename_role: 'rename_role',
  renomearcargo: 'rename_role',

  // === add_role ===
  addrole: 'add_role',
  add_role: 'add_role',
  adicionarcargo: 'add_role',
  adicionarrole: 'add_role',

  // === remove_role ===
  removerole: 'remove_role',
  remove_role: 'remove_role',
  removercargo: 'remove_role',

  // === create_webhook ===
  createwebhook: 'create_webhook',
  create_webhook: 'create_webhook',
  criarwebhook: 'create_webhook',

  // === delete_webhook ===
  deletewebhook: 'delete_webhook',
  delete_webhook: 'delete_webhook',
  deletarwebhook: 'delete_webhook',

  // === send_dm ===
  senddm: 'send_dm',
  send_dm: 'send_dm',
  dm: 'send_dm',
  enviardm: 'send_dm',
  enviar_dm: 'send_dm',
  mensagemprivada: 'send_dm',
  mensagem_privada: 'send_dm',
  privatemessage: 'send_dm',
  private_message: 'send_dm',

  // === unsupported (retorno do modelo quando action não existe) ===
  unsupported: 'unsupported',

  // === missing_parameters (retorno do modelo quando faltam params) ===
  missingparameters: 'missing_parameters',
  missing_parameters: 'missing_parameters',
  missingparam: 'missing_parameters',
  missing_param: 'missing_parameters'
};

// Parâmetros obrigatórios por action — validação final acontece AQUI, no executor
// (não depende da IA para detectar campos faltantes)
const REQUIRED_PARAMS = {
  // Mensagens
  send_message:   ['content'],
  create_embed:   ['title', 'description'],
  send_dm:        ['target', 'content'],

  // Moderação
  ban_user:       ['target'],
  kick_user:      ['target'],
  timeout_user:   ['target', 'duration'],
  remove_timeout: ['target'],
  warn_user:      ['target'],
  remove_warning: ['target'],
  purge_messages: ['count'],

  // Canais
  create_channel: ['name'],
  delete_channel: ['channel_id'],
  rename_channel: ['channel_id', 'new_name'],
  move_channel:   ['channel_id', 'category_id'],
  clone_channel:  ['channel_id'],
  lock_channel:   ['channel_id'],
  unlock_channel: ['channel_id'],

  // Categorias
  create_category: ['name'],
  delete_category: ['category_id'],
  rename_category: ['category_id', 'new_name'],

  // Cargos
  create_role: ['name'],
  delete_role: ['role_id'],
  rename_role: ['role_id', 'new_name'],
  add_role:    ['target', 'role_id'],
  remove_role: ['target', 'role_id'],

  // Webhooks
  create_webhook: ['name'],
  delete_webhook: ['webhook_id', 'channel_id']
};

/**
 * Valida se todos os parâmetros obrigatórios de uma action foram fornecidos.
 * @param {string} actionType - Action normalizada
 * @param {Function} getParam - Função para buscar parâmetros (root + params)
 * @returns {{valid: boolean, missing: string[]}}
 */
function validateRequiredParams(actionType, getParam) {
  const requiredFields = REQUIRED_PARAMS[actionType];
  if (!requiredFields || requiredFields.length === 0) {
    return { valid: true, missing: [] };
  }
  const missing = requiredFields.filter(field => getParam(field) === undefined);
  return { valid: missing.length === 0, missing };
}

/**
 * Decide se uma action + seus params exigem confirmação do usuário.
 * Regras especiais:
 *   - purge_messages: confirmar se count >= 35
 *   - timeout_user: confirmar se duração > 24h
 *   - demais: apenas se estiver em DANGEROUS_ACTIONS
 *   - lock_channel, unlock_channel, remove_timeout, warn_user, etc: NÃO confirmam
 */
function requiresDangerousConfirmation(actionType, count, durationMs, guildId) {
  // QuickPunishment mode: se ativado, NUNCA pede confirmação.
  if (guildSettingsManager.isQuickPunishmentEnabled(guildId)) {
    logger.info('[CONFIRMATION CHECK] SKIPPED', {
      action: actionType,
      reason: 'QuickPunishment mode is enabled for this guild.',
      guildId,
      arquivo: 'src/ai/toolManager.js'
    });
    return false;
  }

  if (actionType === 'purge_messages') {
    const result = count >= PURGE_DANGEROUS_THRESHOLD;
    logger.info('[CONFIRMATION CHECK]', {
      action: actionType,
      count,
      requiresConfirmation: result,
      motivo: result
        ? `purge >= ${PURGE_DANGEROUS_THRESHOLD} mensagens`
        : `purge < ${PURGE_DANGEROUS_THRESHOLD} mensagens (executa direto)`,
      arquivo: 'src/ai/toolManager.js',
      linha: 'requiresDangerousConfirmation()'
    });
    return result;
  }
  if (actionType === 'timeout_user') {
    const result = durationMs > TIMEOUT_DANGEROUS_MS;
    logger.info('[CONFIRMATION CHECK]', {
      action: actionType,
      count: null,
      durationMs,
      requiresConfirmation: result,
      motivo: result
        ? `timeout > 24h (${Math.round(durationMs / 3600000)}h)`
        : `timeout <= 24h — executa direto`,
      arquivo: 'src/ai/toolManager.js',
      linha: 'requiresDangerousConfirmation()'
    });
    return result;
  }
  const result = DANGEROUS_ACTIONS.has(actionType);
  logger.info('[CONFIRMATION CHECK]', {
    action: actionType,
    count: null,
    requiresConfirmation: result,
    motivo: result
      ? `action "${actionType}" está em DANGEROUS_ACTIONS`
      : `action "${actionType}" não exige confirmação`,
    arquivo: 'src/ai/toolManager.js',
    linha: 'requiresDangerousConfirmation()'
  });
  return result;
}

function normalizeAction(action) {
  if (!action) return null;
  const normalized = action.toString().trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const result = ACTION_ALIASES[normalized] || normalized;
  if (normalized !== result) {
    logger.info('[ACTION ALIAS]', {
      original: normalized,
      normalizada: result,
      arquivo: 'src/ai/toolManager.js'
    });
  }
  return result;
}

function parseDuration(value) {
  if (!value) return 0;
  const normalized = String(value).trim().toLowerCase();
  const pattern = /(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/;
  const match = normalized.match(pattern);

  if (match && (match[1] || match[2] || match[3] || match[4])) {
    const days = Number(match[1] || 0);
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    const seconds = Number(match[4] || 0);
    const total = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    return total || 0;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  return 0;
}

function getPermissionForAction(action) {
  switch (action) {
    case 'send_message':
    case 'create_embed':
      return 'SendMessages';
    case 'send_dm':
      return null;
    case 'ban_user':
      return 'BanMembers';
    case 'kick_user':
      return 'KickMembers';
    case 'timeout_user':
    case 'remove_timeout':
      return 'ModerateMembers';
    case 'purge_messages':
      return 'ManageMessages';
    case 'lock_channel':
    case 'unlock_channel':
    case 'create_channel':
    case 'delete_channel':
    case 'rename_channel':
    case 'move_channel':
    case 'clone_channel':
    case 'create_category':
    case 'delete_category':
    case 'rename_category':
      return 'ManageChannels';
    case 'create_role':
    case 'delete_role':
    case 'rename_role':
    case 'add_role':
    case 'remove_role':
      return 'ManageRoles';
    case 'create_webhook':
    case 'delete_webhook':
      return 'ManageWebhooks';
    default:
      return null;
  }
}

function formatConfirmation(action, target, reason, extra = '') {
  const actionLabel = {
    ban_user: 'banir',
    kick_user: 'expulsar',
    timeout_user: 'silenciar',
    remove_timeout: 'remover o silêncio de',
    purge_messages: 'apagar mensagens em',
    lock_channel: 'trancar',
    unlock_channel: 'destrancar'
  }[action] || action;

  let description = `Você deseja ${actionLabel} ${target}`.trim();
  if (reason) {
    description += ` pelo motivo: ${reason}`;
  }
  if (extra) {
    description += ` ${extra}`;
  }
  return description;
}

function resolveChannel(parsedChannel, message) {
  if (!parsedChannel) return message.channel;

  const channelInput = String(parsedChannel).trim();
  if (/^este canal$|^canal atual$/i.test(channelInput)) {
    return message.channel;
  }

  const resolved = findChannel(message.guild, channelInput, message);
  return resolved || message.channel;
}

async function resolveTargetMember(parsed, message) {
  const mention = message.mentions.members?.first();
  if (mention) return mention;

  // Suporta: target, target_user, user_id, target_member, member, member_id
  const identifiers = [parsed.target_member, parsed.target_user, parsed.user_id, parsed.member_id, parsed.target, parsed.member].filter(Boolean);
  for (const candidate of identifiers) {
    const trimmed = String(candidate).trim();
    const idMatch = trimmed.match(/^(?:<@!?)?(\d+)>?$/);
    const id = idMatch ? idMatch[1] : trimmed;
    if (/^\d+$/.test(id)) {
      try {
        const member = await message.guild.members.fetch(id);
        if (member) return member;
      } catch (error) {
        continue;
      }
    }

    const search = trimmed.replace(/^@/, '');
    const found = message.guild.members.cache.find(member =>
      member.user.tag.toLowerCase() === search.toLowerCase() ||
      member.user.username.toLowerCase() === search.toLowerCase() ||
      member.displayName.toLowerCase() === search.toLowerCase()
    );
    if (found) return found;
  }

  return null;
}

function simplifyTargetName(member, parsed, defaultName = 'este usuário') {
  if (member) return `@${member.user.tag}`;
  if (parsed.target || parsed.target_user || parsed.user_id) {
    return String(parsed.target || parsed.target_user || parsed.user_id);
  }
  return defaultName;
}

function buildStructuredEmbed(data) {
  const embed = new EmbedBuilder();
  const color = resolveEmbedColor(data.color, data.type);

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (color) embed.setColor(color);

  const authorName = [data.emoji, data.subtitle].filter(Boolean).join(' ').trim();
  if (authorName) {
    embed.setAuthor({ name: authorName });
  }

  if (data.category) {
    embed.addFields({ name: 'Categoria', value: data.category, inline: true });
  }

  const footerText = [data.footer, data.signature || 'Royal Prussian'].filter(Boolean).join(' • ');
  if (footerText) {
    embed.setFooter({ text: footerText });
  }

  if (data.thumbnail) embed.setThumbnail(data.thumbnail);
  if (data.banner) {
    embed.setImage(data.banner);
  }

  return embed;
}

function resolveEmbedColor(value, type) {
  if (!value && type) {
    const mapped = {
      aviso: '#f1c40f',
      anuncio: '#3498db',
      comunicado: '#3498db',
      evento: '#9b59b6',
      atualizacao: '#2ecc71',
      atualização: '#2ecc71',
      amarelo: '#f1c40f',
      laranja: '#e67e22',
      azul: '#3498db',
      roxo: '#9b59b6',
      verde: '#2ecc71'
    }[type.toLowerCase()];
    if (mapped) return mapped;
  }

  if (!value) return '#3498db';
  return typeof value === 'string' ? value.trim() : '#3498db';
}

async function requestConfirmation(message, description) {
  const confirmationText = `⚠️ Confirmação necessária:
${description}

Digite SIM para confirmar.`;
  const _confirmStack = new Error().stack;
  logger.info('[DISCORD SEND TRACE]', {
    requestId: null,
    contentPreview: confirmationText.substring(0, 80),
    stack: _confirmStack,
    file: 'src/ai/toolManager.js',
    function: 'requestConfirmation'
  });
  const _confirmMsg = await message.channel.send({ content: confirmationText });
  logger.info('[DISCORD SEND END]', {
    sentMessageId: _confirmMsg?.id,
    method: 'message.channel.send()',
    file: 'src/ai/toolManager.js',
    context: 'requestConfirmation'
  });

  const response = await collectResponse(message.channel, message.author.id, config.AI.messageTimeout || 30000);
  if (!response) {
    return false;
  }

  const reply = response.content.trim().toLowerCase();
  return reply === 'sim' || reply === 's';
}

async function logAudit(parsedAction, message, targetMember, targetChannel, reason) {
  const targetId = targetMember?.id || null;
  const targetTag = targetMember?.user?.tag || (parsedAction.target || parsedAction.target_user || null);
  const channelId = targetChannel?.id || message.channelId;

  await contextManager.logAuditAction(
    message.guildId,
    parsedAction.action,
    message.author.id,
    message.author.tag,
    targetId,
    targetTag,
    reason,
    channelId,
    { parsedAction }
  );

  const auditMemoryManager = require('../managers/auditMemoryManager');
  auditMemoryManager.addEvent(message.guildId, {
    source: 'bot_action',
    requestedBy: message.author.id,
    action: parsedAction.action,
    targetId: targetId,
    targetTag: targetTag,
    channelId: channelId,
    timestamp: new Date().toISOString()
  });
  logger.info('[BOT ACTION AUDIT]', {
    requestedBy: message.author.id,
    action: parsedAction.action,
    target: targetId || targetTag
  });
}

module.exports = {
  // Funções legadas foram removidas. Este arquivo agora contém apenas aliases e helpers.
  // A execução de actions é feita pelo pipeline em `messageCreate.js`.
};
