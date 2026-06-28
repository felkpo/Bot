const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const contextManager = require('./contextManager');
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
  remove_mute: 'untimeout_user',
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

// Ações que SEMPRE exigem confirmação (irreversíveis)
const DANGEROUS_ACTIONS = new Set([
  'ban_user',
  'kick_user',
  'delete_channel',
  'delete_role',
  'delete_webhook'
]);

// Limite de purge: abaixo de 35 executa direto; 35+ exige confirmação
const PURGE_DANGEROUS_THRESHOLD = 35;

// Timeout acima de 24h exige confirmação
const TIMEOUT_DANGEROUS_MS = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
// ESTATÍSTICAS DE ACTIONS — contadores, métricas e persistência
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', '..', 'data', 'action-stats.json');
const STATS_SAVE_DEBOUNCE_MS = 30000;

// Contadores em memória
const statsState = {
  // Falhas de validação por (action, field)
  // { create_channel: { name: 12, category_id: 3 } }
  missingParameters: {},
  // Total de execuções por action
  // { create_channel: 58, send_dm: 104 }
  actionExecutions: {},
  // Total de falhas por action (qualquer tipo, não só missing_parameters)
  // { create_channel: 4, send_dm: 12 }
  actionFailures: {},
  // Timestamp do último reset
  lastReset: null,
  // Timestamp da última atualização
  lastUpdate: null
};

// Timer de debounce para persistência
let saveTimer = null;
let savePending = false;

/** Persiste estatísticas em disco (chamada via debounce) */
function persistStats() {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(statsState, null, 2), 'utf8');
    savePending = false;
    logger.info('[STATS PERSIST] Estatísticas salvas em disco', {
      arquivo: STATS_FILE,
      arquivoSource: 'src/ai/toolManager.js',
      lastUpdate: statsState.lastUpdate
    });
  } catch (error) {
    logger.error('[STATS PERSIST ERROR] Falha ao salvar estatísticas', {
      error: error.message,
      arquivo: STATS_FILE,
      arquivoSource: 'src/ai/toolManager.js'
    });
  }
}

/** Agenda salvamento com debounce de 30 segundos */
function schedulePersist() {
  savePending = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistStats, STATS_SAVE_DEBOUNCE_MS);
}

/** Carrega estatísticas do disco no startup */
function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      logger.info('[STATS LOAD] Arquivo não existe — começando do zero', {
        arquivo: STATS_FILE,
        arquivoSource: 'src/ai/toolManager.js'
      });
      return;
    }
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.missingParameters) statsState.missingParameters = parsed.missingParameters;
    if (parsed.actionExecutions) statsState.actionExecutions = parsed.actionExecutions;
    if (parsed.actionFailures) statsState.actionFailures = parsed.actionFailures;
    if (parsed.lastReset) statsState.lastReset = parsed.lastReset;
    logger.info('[STATS LOAD] Estatísticas carregadas do disco', {
      arquivo: STATS_FILE,
      arquivoSource: 'src/ai/toolManager.js',
      actionsMonitored: Object.keys(statsState.actionExecutions).length,
      totalExecutions: Object.values(statsState.actionExecutions).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    logger.error('[STATS LOAD ERROR] Falha ao carregar estatísticas — começando do zero', {
      error: error.message,
      arquivo: STATS_FILE,
      arquivoSource: 'src/ai/toolManager.js'
    });
  }
}

// Carrega no momento do require (startup)
loadStats();

/** Registra uma falha de validação de parâmetro */
function recordMissingParam(action, field) {
  if (!statsState.missingParameters[action]) statsState.missingParameters[action] = {};
  statsState.missingParameters[action][field] = (statsState.missingParameters[action][field] || 0) + 1;
  statsState.lastUpdate = new Date().toISOString();
  schedulePersist();
}

/** Registra uma execução (chamada de switch bem-sucedida ou com falha) */
function recordExecution(action) {
  statsState.actionExecutions[action] = (statsState.actionExecutions[action] || 0) + 1;
  statsState.lastUpdate = new Date().toISOString();
  schedulePersist();
}

/** Registra uma falha de execução (qualquer motivo) */
function recordFailure(action) {
  statsState.actionFailures[action] = (statsState.actionFailures[action] || 0) + 1;
  statsState.lastUpdate = new Date().toISOString();
  schedulePersist();
}

/** Retorna snapshot das estatísticas (imutável) */
function getMissingParameterStats() {
  return JSON.parse(JSON.stringify(statsState.missingParameters));
}

/** Retorna métricas de execução */
function getActionMetrics() {
  return {
    executions: JSON.parse(JSON.stringify(statsState.actionExecutions)),
    failures: JSON.parse(JSON.stringify(statsState.actionFailures)),
    missingParameters: JSON.parse(JSON.stringify(statsState.missingParameters)),
    lastReset: statsState.lastReset,
    lastUpdate: statsState.lastUpdate
  };
}

/** Reseta todas as estatísticas e persiste */
function resetMissingParameterStats() {
  statsState.missingParameters = {};
  statsState.actionExecutions = {};
  statsState.actionFailures = {};
  statsState.lastReset = new Date().toISOString();
  statsState.lastUpdate = new Date().toISOString();
  // Persistência imediata (não debounce) — usuário acabou de confirmar reset
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  persistStats();
}

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

async function executeToolAction(parsedAction, message) {
  const ARQUIVO = 'src/ai/toolManager.js';
  const LINHA_BASE = 366; // linha da função

  function logErro(origem, motivo, extra = {}) {
    logger.warn('[ACTION ERROR]', {
      origem,
      motivo,
      arquivo: ARQUIVO,
      linha: LINHA_BASE + origem, // estimativa
      ...extra
    });
  }

  function logResultado(success, dados = {}) {
    logger.info('[ACTION RESULT]', {
      success,
      ...dados,
      arquivo: ARQUIVO,
      funcao: 'executeToolAction'
    });
  }

  // 1. Validação inicial
  if (!parsedAction || typeof parsedAction !== 'object' || !parsedAction.action) {
    const motivo = 'Ação inválida retornada pela IA';
    logErro('validacao_inicial', motivo, { parsedAction });
    logResultado(false, { reason: motivo });
    return { success: false, error: motivo };
  }

  // Log inicial da ação
  logger.info('[ACTION]', {
    acao: parsedAction.action,
    argumentos: parsedAction,
    usuario: message.author?.tag,
    server: message.guild?.name,
    canal: message.channel?.name,
    arquivo: ARQUIVO,
    funcao: 'executeToolAction'
  });

  // 2. Verifica se comandos administrativos estão habilitados
  if (!config.FEATURES.ADMIN_COMMANDS_ENABLED) {
    const motivo = 'Comandos administrativos estão desativados';
    logErro('admin_disabled', motivo);
    logResultado(false, { reason: motivo });
    return { success: false, error: motivo };
  }

  // 3. ADMIN CHECK com log detalhado
  const adminCheck = isAdmin(message.member);
  logger.info('[ACTION ADMIN CHECK]', {
    user: message.author?.tag,
    memberId: message.author?.id,
    isAdmin: adminCheck,
    roles: message.member?.roles?.cache?.map(r => r.name) || [],
    arquivo: ARQUIVO,
    funcao: 'isAdmin (src/utils/helpers.js:37)'
  });

  if (!adminCheck) {
    const motivo = 'Apenas administradores podem executar ações administrativas';
    logErro('admin_check', motivo, {
      usuario: message.author?.tag,
      memberRoles: message.member?.roles?.cache?.map(r => r.name) || []
    });
    logResultado(false, { reason: motivo });
    return { success: false, error: motivo };
  }

  // 4. Extrai `params` (a IA pode retornar no formato plano OU com objeto params)
  //    { action, channel_id, content }                    ← plano
  //    { action, params: { channel_id, content } }        ← params
  const params = parsedAction.params || {};
  const camposRaiz = Object.keys(parsedAction);
  const camposParams = Object.keys(params);
  const camposNormalizados = [...new Set([...camposRaiz, ...camposParams.map(p => `params.${p}`)])].join(', ');

  // Helper multi-key: tenta cada chave primeiro na raiz, depois em params
  function getParam(...keys) {
    for (const key of keys) {
      if (parsedAction[key] !== undefined && parsedAction[key] !== null) return parsedAction[key];
      if (params[key] !== undefined && params[key] !== null) return params[key];
    }
    return undefined;
  }

  // Helper para extrair todo o objeto de dados para embed (considerando params)
  function getData(obj) {
    return obj.params || obj;
  }

  logger.info('[ACTION PARAMS]', {
    action: parsedAction.action,
    paramsDetectados: camposParams.length > 0 ? camposParams.join(', ') : '(nenhum)',
    camposNormalizados,
    channelId: getParam('channel_id', 'channelId', 'channel') || '(não informado)',
    content: (getParam('content', 'message', 'text', 'msg', 'body') || '').substring(0, 100) || '(vazio)',
    arquivo: ARQUIVO
  });

  // 5. Normaliza ação
  const actionType = normalizeAction(parsedAction.action);
  logger.info('[ACTION] acao normalizada', {
    actionOriginal: parsedAction.action,
    actionNormalized: actionType || '(null)',
    arquivo: ARQUIVO
  });

  if (!actionType) {
    const motivo = `Ação "${parsedAction.action}" não encontrada nos aliases`;
    logErro('normalize_action', motivo, { aliasesDisponiveis: Object.keys(ACTION_ALIASES) });
    logResultado(false, { reason: motivo });
    return { success: false, error: motivo };
  }

  // Trata action "unsupported" retornada pelo modelo graciosamente — sem stack trace, sem erro no Discord
  if (actionType === 'unsupported') {
    logger.info('[ACTION UNSUPPORTED] modelo retornou action=unsupported — nenhuma ação disponível para este pedido', {
      originalAction: parsedAction.action,
      arquivo: ARQUIVO
    });
    logResultado(false, { reason: 'action=unsupported retornado pelo modelo' });
    return { success: false, error: 'Não consigo executar essa ação. Tente descrever de outra forma.' };
  }

  // Trata action "missing_parameters" retornada pelo modelo graciosamente — sem stack trace
  if (actionType === 'missing_parameters') {
    const required = Array.isArray(parsedAction.required)
      ? parsedAction.required
      : (parsedAction.required ? [parsedAction.required] : ['parâmetros não especificados']);
    logger.info('[ACTION MISSING PARAMETERS] modelo retornou missing_parameters — faltam informações', {
      originalAction: parsedAction.action,
      required,
      arquivo: ARQUIVO
    });
    logResultado(false, { reason: `faltam parâmetros: ${required.join(', ')}` });
    return { success: false, error: `Faltam informações: ${required.join(', ')}.`, contextMessage: `Faltam: ${required.join(', ')}.` };
  }

  // 6. Resolve canal (suporta channel_id, channel_name, channel tanto plano quanto dentro de params)
  const channelInput = getParam('channel') || getParam('channel_name') || getParam('channel_id') || getParam('target');
  const targetChannel = resolveChannel(channelInput, message);
  logger.info('[ACTION] canal', {
    inputCanal: channelInput || '(não informado)',
    canalResolvido: targetChannel?.name || targetChannel?.id || '(null)',
    canalId: targetChannel?.id || '(null)',
    isTextBased: targetChannel?.isTextBased ? targetChannel.isTextBased() : 'N/A',
    cachePresent: targetChannel ? true : false,
    arquivo: ARQUIVO
  });

  // 7. Resolve membro alvo (se houver, suporta target, target_user, user_id, member tanto plano quanto dentro de params)
  const memberInput = getParam('target') || getParam('target_user') || getParam('user_id');
  const targetMember = memberInput
    ? await resolveTargetMember(parsedAction, message)
    : null;
  logger.info('[ACTION] membro alvo', {
    inputAlvo: memberInput || '(não informado)',
    membroResolvido: targetMember?.user?.tag || targetMember?.id || '(null)',
    membroId: targetMember?.id || '(null)',
    arquivo: ARQUIVO
  });

  // 8. Extrai parâmetros (suporta reason/motivo, count/amount/limit, duration/time/tempo tanto plano quanto dentro de params)
  const reason = getParam('reason') || getParam('motivo') || 'Sem motivo especificado.';

  // NORMALEZAÇÃO PURGE_MESSAGES: aceita count, amount, limit — antes da validação
  let purgeCount = Number(getParam('count') || getParam('amount') || getParam('limit') || 0) || 0;
  if (actionType === 'purge_messages') {
    // Injeta count normalizado para que getParam('count') funcione na validação
    if (parsedAction.params) {
      parsedAction.params.count = purgeCount;
    } else {
      parsedAction.params = { count: purgeCount };
    }
    // Também injeta na raiz para compatibilidade
    parsedAction.count = purgeCount;

    logger.info('[PURGE NORMALIZED]', {
      originalCount: getParam('count'),
      originalAmount: getParam('amount'),
      originalLimit: getParam('limit'),
      finalCount: purgeCount,
      arquivo: ARQUIVO
    });
  }

  const count = purgeCount;
  const duration = parseDuration(getParam('duration') || getParam('time') || getParam('tempo') || getParam('length') || getParam('duration_ms') || 0);

  // 8.1. Validação final de parâmetros obrigatórios (no executor, não depende da IA)
  logger.info('[PURGE DEBUG BEFORE VALIDATION]', {
    action: actionType,
    count,
    paramsKeys: parsedAction.params ? Object.keys(parsedAction.params) : 'none',
    rootKeys: Object.keys(parsedAction).filter(k => k !== 'action'),
    arquivo: ARQUIVO
  });

  const paramValidation = validateRequiredParams(actionType, getParam);

  logger.info('[PURGE DEBUG AFTER VALIDATION]', {
    action: actionType,
    valid: paramValidation.valid,
    missing: paramValidation.missing,
    arquivo: ARQUIVO
  });
  if (!paramValidation.valid) {
    // Log estatístico para identificar campos mais esquecidos
    logger.info('[PARAM VALIDATION]', {
      action: actionType,
      missing: paramValidation.missing.join(','),
      user: message.author?.tag || '(desconhecido)',
      channel: message.channel?.name || message.channelId || '(desconhecido)',
      required: REQUIRED_PARAMS[actionType] || [],
      receivedKeys: Object.keys(parsedAction).filter(k => k !== 'action').join(',') + (Object.keys(params).length ? '|params:' + Object.keys(params).join(',') : ''),
      arquivo: ARQUIVO
    });

    // Incrementa contador para cada campo faltante
    for (const field of paramValidation.missing) {
      recordMissingParam(actionType, field);
    }

    logResultado(false, {
      reason: `faltam parâmetros: ${paramValidation.missing.join(', ')}`,
      action: 'missing_parameters',
      missing: paramValidation.missing
    });
    return {
      success: false,
      action: 'missing_parameters',
      missing: paramValidation.missing,
      error: `Faltam informações: ${paramValidation.missing.join(', ')}.`,
      contextMessage: `Faltam: ${paramValidation.missing.join(', ')}.`
    };
  }

  // Log quando validação passa — usado para confirmar fluxo correto
  const requiredForAction = REQUIRED_PARAMS[actionType];
  if (requiredForAction && requiredForAction.length > 0) {
    logger.info('[PARAM VALIDATION SUCCESS]', {
      action: actionType,
      required: requiredForAction.join(','),
      arquivo: ARQUIVO
    });
  }

  // Nova política: usa requiresDangerousConfirmation() — considera count/duration por action
  const confirmationRequired = requiresDangerousConfirmation(actionType, count, duration, message.guildId);
  const targetName = simplifyTargetName(targetMember, parsedAction);

  // Log [ACTION CONFIRMATION] — registra decisão de confirmação para auditoria
  logger.info('[ACTION CONFIRMATION]', {
    action: actionType,
    requiresConfirmation: confirmationRequired,
    reason,
    count: count || null,
    durationMs: duration || null,
    user: message.author?.tag,
    arquivo: ARQUIVO,
    linha: 'executeToolAction() — após requiresDangerousConfirmation()'
  });

  // 8. Verifica permissão do bot
  const requiredPermission = getPermissionForAction(actionType);
  if (requiredPermission) {
    const hasPerm = botHasPermission(targetChannel, message.client, requiredPermission);
    logger.info('[ACTION] permissão', {
      permissaoNecessaria: requiredPermission,
      temPermissao: hasPerm,
      arquivo: ARQUIVO
    });
    if (!hasPerm) {
      const motivo = `Bot não tem permissão ${requiredPermission} no canal`;
      logErro('bot_permission', motivo, { canal: targetChannel?.name || targetChannel?.id });
      logResultado(false, { reason: motivo });
      return { success: false, error: `Não tenho permissão ${requiredPermission} para executar esta ação.` };
    }
  }

  // 9. Confirmação para ações perigosas
  if (confirmationRequired) {
    const description = formatConfirmation(actionType, targetName, reason, count ? `Quantidade: ${count}.` : '');
    const confirmed = await requestConfirmation(message, description);
    if (!confirmed) {
      const motivo = 'Ação cancelada pelo usuário';
      logResultado(false, { reason: motivo });
      return { success: false, summary: motivo };
    }
  }

  // [ACTION ALLOWED] — action passou por todas as verificações e será executada
  logger.info('[ACTION ALLOWED]', {
    action: actionType,
    user: message.author?.tag,
    arquivo: ARQUIVO
  });

  // 10. Execução
  try {
    // Registra execução para estatísticas (qualquer switch entry conta)
    recordExecution(actionType);

    logger.info('[ACTION] executando switch', {
      actionType,
      content: (getParam('content', 'message', 'text', 'body') || '(vazio)').substring(0, 100),
      actionData: getData(parsedAction),
      arquivo: ARQUIVO
    });

    switch (actionType) {
      case 'send_message': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          const motivo = 'Canal de destino inválido para enviar mensagem';
          logErro('send_message_channel', motivo, {
            targetChannelId: targetChannel?.id || '(null)',
            isTextBased: targetChannel?.isTextBased ? targetChannel.isTextBased() : 'N/A'
          });
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }

        // Ordem de precedência: content (campo mais comum da IA), message, text, msg, body
        // Suporta tanto plano (parsedAction.content) quanto dentro de params (params.content)
        const content = getParam('content') || getParam('message') || getParam('text') || getParam('msg') || getParam('body') || '';
        logger.info('[ACTION SEND_MESSAGE]', {
          contentRecebido: (getParam('content') || '').substring(0, 100),
          camposDisponiveis: Object.keys(parsedAction).join(', ') + (Object.keys(params).length ? ' | params: ' + Object.keys(params).join(', ') : ''),
          camposConhecidos: 'content, message, text, msg, body (plano ou dentro de params)',
          contentFinal: content.substring(0, 100) || '(vazio)',
          arquivo: ARQUIVO
        });
        if (!content.trim()) {
          const motivo = 'Conteúdo da mensagem não foi fornecido';
          logErro('send_message_content', motivo, {
            camposRecebidos: Object.keys(parsedAction).join(', '),
            paramsRecebidos: Object.keys(params).length ? Object.keys(params).join(', ') : '(nenhum)'
          });
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }

        logger.info('[ACTION] executando send_message', {
          canal: targetChannel.name || targetChannel.id,
          conteudo: content.substring(0, 100),
          arquivo: ARQUIVO
        });
        const _sendStack = new Error().stack;
        logger.info('[DISCORD SEND TRACE]', {
          requestId: null,
          contentPreview: (content || '').substring(0, 80),
          stack: _sendStack,
          file: 'src/ai/toolManager.js',
          function: 'executeToolAction/send_message'
        });
        const _sentMsg = await targetChannel.send({ content });
        logger.info('[DISCORD SEND END]', {
          sentMessageId: _sentMsg?.id,
          method: 'targetChannel.send()',
          file: 'src/ai/toolManager.js',
          context: 'send_message'
        });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, {
          summary: `Mensagem enviada com sucesso em ${targetChannel}.`,
          canal: targetChannel.name || targetChannel.id
        });
        return {
          success: true,
          summary: `Mensagem enviada com sucesso em ${targetChannel}.`,
          contextMessage: `Mensagem enviada em ${targetChannel}.`
        };
      }

      case 'create_embed': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          const motivo = 'Canal de destino inválido para criar o embed';
          logErro('create_embed_channel', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        // Usa getData() para extrair dados do embed (tanto raiz quanto params)
        const embedData = getData(parsedAction);
        const embedTitle = getParam('title') || '';
        const embedDescription = getParam('description') || '';
        const embedColor = getParam('color') || embedData.color || '';
        logger.info('[ACTION EMBED]', {
          title: embedTitle.substring(0, 100),
          description: embedDescription.substring(0, 100),
          color: embedColor,
          arquivo: ARQUIVO
        });
        const embed = buildStructuredEmbed(embedData);
        if (!embed.data.title && !embed.data.description) {
          const motivo = 'Embed inválido gerado pela IA (sem title nem description)';
          logErro('create_embed_invalid', motivo, {
            tituloEncontrado: embedTitle || '(vazio)',
            descricaoEncontrada: embedDescription || '(vazio)',
            paramsRecebidos: Object.keys(params).length ? Object.keys(params).join(', ') : '(nenhum)'
          });
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        logger.info('[ACTION EMBED] executando', {
          canal: targetChannel.name || targetChannel.id,
          arquivo: ARQUIVO
        });
        const _embedStack = new Error().stack;
        logger.info('[DISCORD SEND TRACE]', {
          requestId: null,
          contentPreview: '[embed]',
          stack: _embedStack,
          file: 'src/ai/toolManager.js',
          function: 'executeToolAction/create_embed'
        });
        const _embedMsg = await targetChannel.send({ embeds: [embed] });
        logger.info('[DISCORD SEND END]', {
          sentMessageId: _embedMsg?.id,
          method: 'targetChannel.send()',
          file: 'src/ai/toolManager.js',
          context: 'create_embed'
        });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Embed enviado em ${targetChannel}.` });
        return { success: true, summary: `Embed enviado com sucesso em ${targetChannel}.`, contextMessage: `Embed enviado em ${targetChannel}.` };
      }

      case 'ban_user': {
        if (!targetMember) {
          const motivo = 'Membro alvo não encontrado para banimento';
          logErro('ban_no_member', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        if (!targetMember.bannable) {
          const motivo = 'Bot não pode banir este usuário';
          logErro('ban_not_bannable', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: 'Não posso banir esse usuário. Verifique minha hierarquia de cargos.' };
        }
        await targetMember.ban({ reason });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Usuário ${targetName} banido.` });
        return { success: true, summary: `Usuário ${targetName} banido com sucesso.`, contextMessage: `Usuário banido: ${targetName}.` };
      }

      case 'unban_user': {
        // Para desbanir, o ID ou tag precisa ser especificado, não temos targetMember no cache da guilda se ele estiver banido.
        const unbanTarget = getParam('target') || getParam('target_user') || getParam('user_id');
        if (!unbanTarget) {
          const motivo = 'Usuário alvo não especificado para desbanimento';
          logErro('unban_no_target', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        
        // Remove marcações do Discord <@!123>
        const cleanTarget = String(unbanTarget).replace(/[<@!>]/g, '').trim();
        
        try {
          await message.guild.members.unban(cleanTarget, reason);
          await logAudit(parsedAction, message, { id: cleanTarget, user: { tag: cleanTarget } }, targetChannel, reason);
          logResultado(true, { summary: `Usuário ${cleanTarget} desbanido.` });
          return { success: true, summary: `Usuário ${cleanTarget} desbanido com sucesso.`, contextMessage: `Usuário desbanido: ${cleanTarget}.` };
        } catch (err) {
          const motivo = `Falha ao desbanir usuário: ${err.message}`;
          logErro('unban_failed', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: 'Não foi possível desbanir o usuário. Verifique se o ID está correto e se ele realmente está banido.' };
        }
      }

      case 'kick_user': {
        if (!targetMember) {
          const motivo = 'Membro alvo não encontrado para expulsão';
          logErro('kick_no_member', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        if (!targetMember.kickable) {
          const motivo = 'Bot não pode expulsar este usuário';
          logErro('kick_not_kickable', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: 'Não posso expulsar esse usuário. Verifique minha hierarquia de cargos.' };
        }
        await targetMember.kick(reason);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Usuário ${targetName} expulso.` });
        return { success: true, summary: `Usuário ${targetName} expulso com sucesso.`, contextMessage: `Usuário expulso: ${targetName}.` };
      }

      case 'timeout_user': {
        if (!targetMember) {
          const motivo = 'Membro alvo não encontrado para silenciamento';
          logErro('timeout_no_member', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        if (!duration) {
          const motivo = 'Duração inválida para timeout';
          logErro('timeout_no_duration', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        await targetMember.timeout(duration, reason);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `${targetName} silenciado por ${Math.round(duration / 60000)} min.` });
        return { success: true, summary: `Usuário ${targetName} silenciado por ${Math.round(duration / 60000)} minuto(s).`, contextMessage: `Timeout aplicado para ${targetName}.` };
      }

      case 'remove_timeout': {
        if (!targetMember) {
          const motivo = 'Membro alvo não encontrado para remover timeout';
          logErro('remove_timeout_no_member', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        await targetMember.timeout(null, reason);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Timeout removido de ${targetName}.` });
        return { success: true, summary: `Timeout removido de ${targetName}.`, contextMessage: `Timeout removido de ${targetName}.` };
      }

      case 'warn_user': {
        if (!targetMember) {
          const motivo = 'Membro alvo não encontrado para advertência';
          logErro('warn_no_member', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        const warningMessage = `Você recebeu uma advertência no servidor ${message.guild.name}. Motivo: ${reason}`;
        try {
          const _warnStack = new Error().stack;
          logger.info('[DISCORD SEND TRACE]', {
            requestId: null,
            contentPreview: (warningMessage || '').substring(0, 80),
            stack: _warnStack,
            file: 'src/ai/toolManager.js',
            function: 'executeToolAction/warn_user'
          });
          const _warnMsg = await targetMember.send({ content: warningMessage });
          logger.info('[DISCORD SEND END]', {
            sentMessageId: _warnMsg?.id,
            method: 'targetMember.send()',
            file: 'src/ai/toolManager.js',
            context: 'warn_user DM'
          });
        } catch (_) {
          logger.warn('⚠️ Não foi possível enviar aviso por DM', { target: targetName });
        }
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Advertência registrada para ${targetName}.` });
        return { success: true, summary: `Advertência registrada para ${targetName}.`, contextMessage: `Advertência aplicada em ${targetName}.` };
      }

      case 'remove_warning': {
        if (!targetMember) {
          const motivo = 'Membro alvo não encontrado para remover advertência';
          logErro('remove_warning_no_member', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Remoção de advertência registrada para ${targetName}.` });
        return { success: true, summary: `Remoção de advertência registrada para ${targetName}.`, contextMessage: `Advertência removida de ${targetName}.` };
      }

      case 'purge_messages': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          const motivo = 'Canal inválido para limpar mensagens';
          logErro('purge_invalid_channel', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        if (!count || count <= 0) {
          const motivo = 'Quantidade de mensagens inválida para exclusão';
          logErro('purge_invalid_count', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }

        const purgeLimit = Math.min(count, 100);
        logger.info('[PURGE DEBUG]', {
          requestedCount: count,
          resolvedCount: purgeLimit,
          requiresConfirmation: confirmationRequired,
          channelId: targetChannel.id,
          channelName: targetChannel.name,
          arquivo: ARQUIVO
        });

        // Busca mensagens
        const fetchedMsgs = await targetChannel.messages.fetch({ limit: purgeLimit });
        logger.info('[PURGE FETCH]', {
          messagesFound: fetchedMsgs.size,
          arquivo: ARQUIVO
        });

        // Filtra mensagens mais antigas que 14 dias (bulkDelete não aceita)
        const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const deletable = fetchedMsgs.filter(m => m.createdTimestamp > twoWeeksAgo);
        const oldCount = fetchedMsgs.size - deletable.size;
        logger.info('[PURGE OLD MESSAGES]', {
          olderThan14Days: oldCount,
          arquivo: ARQUIVO
        });

        const deleted = await targetChannel.bulkDelete(deletable, true);

        logger.info('[PURGE RESULT]', {
          requested: count,
          deleted: deleted.size,
          ignoredOldMessages: oldCount,
          success: true,
          arquivo: ARQUIVO
        });

        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Limpeza: ${deleted.size} msg(s) apagada(s).` });

        const summaryParts = [`Limpeza concluída: ${deleted.size} mensagem(s) apagada(s) em ${targetChannel}.`];
        if (oldCount > 0) {
          summaryParts.push(`(${oldCount} mensagem(s) ignorada(s) por terem mais de 14 dias.)`);
        }
        return { success: true, summary: summaryParts.join(' '), contextMessage: `Mensagens apagadas em ${targetChannel}.` };
      }

      // ── CANAIS ───────────────────────────────────────────────────────────────

      case 'create_channel': {
        const chName = getParam('name') || 'novo-canal';
        const chTypeParsed = (getParam('channel_type') || getParam('type') || 'text').toLowerCase();
        const categoryId = getParam('category_id') || getParam('category') || null;
        const typeMap = { text: 0, voice: 2, forum: 15, stage: 13 };
        const chType = typeMap[chTypeParsed] ?? 0;

        // Resolve categoria para log (verifica se ID existe no servidor)
        const categoryResolved = categoryId
          ? message.guild.channels.cache.get(categoryId)?.name || '(ID não encontrado no cache)'
          : '(sem categoria)';

        logger.info('[CREATE CHANNEL]', {
          name: chName,
          channelType: chTypeParsed,
          channelTypeNumeric: chType,
          categoryId: categoryId || '(não informado)',
          categoryResolved,
          arquivo: ARQUIVO
        });

        const options = { name: chName, type: chType, reason };
        if (categoryId) options.parent = categoryId;
        const newCh = await message.guild.channels.create(options);
        await logAudit(parsedAction, message, null, newCh, reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, channel: newCh.name, arquivo: ARQUIVO });
        logResultado(true, { summary: `Canal ${newCh.name} criado.` });
        return { success: true, summary: `Canal **${newCh.name}** criado com sucesso.`, contextMessage: `Canal criado: ${newCh.name}.` };
      }

      case 'delete_channel': {
        const delCh = targetChannel;
        if (!delCh) { logResultado(false, { reason: 'Canal não encontrado.' }); return { success: false, error: 'Canal não encontrado.' }; }
        const delChName = delCh.name;
        await delCh.delete(reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Canal ${delChName} deletado.` });
        return { success: true, summary: `Canal **${delChName}** deletado com sucesso.`, contextMessage: `Canal deletado: ${delChName}.` };
      }

      case 'rename_channel': {
        const newChName = getParam('new_name') || getParam('name') || '';
        if (!newChName.trim()) { logResultado(false, { reason: 'Novo nome não informado.' }); return { success: false, error: 'Novo nome não informado.' }; }
        const oldChName = targetChannel.name;
        await targetChannel.setName(newChName.trim(), reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, oldName: oldChName, newName: newChName, arquivo: ARQUIVO });
        logResultado(true, { summary: `Canal renomeado: ${oldChName} → ${newChName}.` });
        return { success: true, summary: `Canal renomeado de **${oldChName}** para **${newChName}**.`, contextMessage: `Canal renomeado.` };
      }

      case 'move_channel': {
        const moveCatId = getParam('category_id') || getParam('category') || null;
        if (!moveCatId) { logResultado(false, { reason: 'ID da categoria não informado.' }); return { success: false, error: 'ID da categoria não informado.' }; }
        await targetChannel.setParent(moveCatId, { reason });
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Canal ${targetChannel.name} movido.` });
        return { success: true, summary: `Canal **${targetChannel.name}** movido para a categoria.`, contextMessage: `Canal movido.` };
      }

      case 'clone_channel': {
        const cloneName = getParam('name') || undefined;
        const cloned = await targetChannel.clone({ name: cloneName, reason });
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, clonedName: cloned.name, arquivo: ARQUIVO });
        logResultado(true, { summary: `Canal clonado: ${cloned.name}.` });
        return { success: true, summary: `Canal clonado com sucesso: **${cloned.name}**.`, contextMessage: `Canal clonado.` };
      }

      // ── CATEGORIAS ────────────────────────────────────────────────────────────

      case 'create_category': {
        const catName = getParam('name') || 'Nova Categoria';
        const newCat = await message.guild.channels.create({ name: catName, type: 4, reason });
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, category: newCat.name, arquivo: ARQUIVO });
        logResultado(true, { summary: `Categoria "${newCat.name}" criada.` });
        return { success: true, summary: `Categoria **${newCat.name}** criada com sucesso.`, contextMessage: `Categoria criada.` };
      }

      case 'delete_category': {
        const catInput = getParam('category_id') || getParam('category') || getParam('name') || channelInput || '';
        const cat = message.guild.channels.cache.find(c => c.type === 4 && (c.id === catInput || c.name.toLowerCase() === catInput.toLowerCase()));
        if (!cat) { logResultado(false, { reason: 'Categoria não encontrada.' }); return { success: false, error: 'Categoria não encontrada.' }; }
        const catDelName = cat.name;
        await cat.delete(reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Categoria "${catDelName}" deletada.` });
        return { success: true, summary: `Categoria **${catDelName}** deletada com sucesso.`, contextMessage: `Categoria deletada.` };
      }

      case 'rename_category': {
        const catRenInput = getParam('category_id') || getParam('category') || getParam('old_name') || channelInput || '';
        const newCatName = getParam('new_name') || getParam('name') || '';
        const catRen = message.guild.channels.cache.find(c => c.type === 4 && (c.id === catRenInput || c.name.toLowerCase() === catRenInput.toLowerCase()));
        if (!catRen || !newCatName.trim()) { logResultado(false, { reason: 'Categoria ou nome não encontrado.' }); return { success: false, error: 'Categoria ou nome não encontrado.' }; }
        await catRen.setName(newCatName.trim(), reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Categoria renomeada para ${newCatName}.` });
        return { success: true, summary: `Categoria renomeada para **${newCatName}**.`, contextMessage: `Categoria renomeada.` };
      }

      // ── CARGOS ───────────────────────────────────────────────────────────────

      case 'create_role': {
        const roleName = getParam('name') || 'Novo Cargo';
        const roleColor = getParam('color') || null;
        const newRole = await message.guild.roles.create({ name: roleName, color: roleColor, reason });
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, role: newRole.name, arquivo: ARQUIVO });
        logResultado(true, { summary: `Cargo "${newRole.name}" criado.` });
        return { success: true, summary: `Cargo **${newRole.name}** criado com sucesso.`, contextMessage: `Cargo criado.` };
      }

      case 'delete_role': {
        const roleDelInput = getParam('role_id') || getParam('role') || getParam('name') || '';
        const roleDel = message.guild.roles.cache.find(r => r.id === roleDelInput || r.name.toLowerCase() === roleDelInput.toLowerCase());
        if (!roleDel) { logResultado(false, { reason: 'Cargo não encontrado.' }); return { success: false, error: 'Cargo não encontrado.' }; }
        const roleDelName = roleDel.name;
        await roleDel.delete(reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Cargo "${roleDelName}" deletado.` });
        return { success: true, summary: `Cargo **${roleDelName}** deletado com sucesso.`, contextMessage: `Cargo deletado.` };
      }

      case 'rename_role': {
        const roleRenInput = getParam('role_id') || getParam('role') || getParam('old_name') || '';
        const newRoleName = getParam('new_name') || getParam('name') || '';
        const roleRen = message.guild.roles.cache.find(r => r.id === roleRenInput || r.name.toLowerCase() === roleRenInput.toLowerCase());
        if (!roleRen || !newRoleName.trim()) { logResultado(false, { reason: 'Cargo ou nome não encontrado.' }); return { success: false, error: 'Cargo ou nome não encontrado.' }; }
        await roleRen.setName(newRoleName.trim(), reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Cargo renomeado para ${newRoleName}.` });
        return { success: true, summary: `Cargo renomeado para **${newRoleName}**.`, contextMessage: `Cargo renomeado.` };
      }

      case 'add_role': {
        if (!targetMember) { logResultado(false, { reason: 'Membro não encontrado.' }); return { success: false, error: 'Membro não encontrado.' }; }
        const addRoleInput = getParam('role_id') || getParam('role') || '';
        const addRole = message.guild.roles.cache.find(r => r.id === addRoleInput || r.name.toLowerCase() === addRoleInput.toLowerCase());
        if (!addRole) { logResultado(false, { reason: 'Cargo não encontrado.' }); return { success: false, error: 'Cargo não encontrado.' }; }
        await targetMember.roles.add(addRole, reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Cargo "${addRole.name}" adicionado a ${targetName}.` });
        return { success: true, summary: `Cargo **${addRole.name}** adicionado a ${targetName}.`, contextMessage: `Cargo adicionado.` };
      }

      case 'remove_role': {
        if (!targetMember) { logResultado(false, { reason: 'Membro não encontrado.' }); return { success: false, error: 'Membro não encontrado.' }; }
        const remRoleInput = getParam('role_id') || getParam('role') || '';
        const remRole = message.guild.roles.cache.find(r => r.id === remRoleInput || r.name.toLowerCase() === remRoleInput.toLowerCase());
        if (!remRole) { logResultado(false, { reason: 'Cargo não encontrado.' }); return { success: false, error: 'Cargo não encontrado.' }; }
        await targetMember.roles.remove(remRole, reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Cargo "${remRole.name}" removido de ${targetName}.` });
        return { success: true, summary: `Cargo **${remRole.name}** removido de ${targetName}.`, contextMessage: `Cargo removido.` };
      }

      // ── WEBHOOKS ─────────────────────────────────────────────────────────────

      case 'create_webhook': {
        if (!targetChannel || !targetChannel.isTextBased()) { logResultado(false, { reason: 'Canal inválido para webhook.' }); return { success: false, error: 'Canal inválido.' }; }
        const webhookName = getParam('name') || 'Webhook';
        const webhook = await targetChannel.createWebhook({ name: webhookName, reason });
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, webhook: webhook.name, arquivo: ARQUIVO });
        logResultado(true, { summary: `Webhook "${webhook.name}" criado em ${targetChannel.name}.` });
        return { success: true, summary: `Webhook **${webhook.name}** criado em **${targetChannel.name}**.`, contextMessage: `Webhook criado.` };
      }

      case 'delete_webhook': {
        if (!targetChannel || !targetChannel.isTextBased()) { logResultado(false, { reason: 'Canal inválido.' }); return { success: false, error: 'Canal inválido.' }; }
        const webhookId = getParam('webhook_id') || getParam('id') || getParam('name') || '';
        const webhooks = await targetChannel.fetchWebhooks();
        const wh = webhooks.find(w => w.id === webhookId || w.name.toLowerCase() === webhookId.toLowerCase());
        if (!wh) { logResultado(false, { reason: 'Webhook não encontrado.' }); return { success: false, error: 'Webhook não encontrado.' }; }
        const whName = wh.name;
        await wh.delete(reason);
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, arquivo: ARQUIVO });
        logResultado(true, { summary: `Webhook "${whName}" deletado.` });
        return { success: true, summary: `Webhook **${whName}** deletado com sucesso.`, contextMessage: `Webhook deletado.` };
      }

      // ── UTILIDADES ───────────────────────────────────────────────────────────

      case 'send_dm': {
        if (!targetMember) { logResultado(false, { reason: 'Membro não encontrado.' }); return { success: false, error: 'Membro não encontrado para DM.' }; }
        const dmContent = getParam('content') || getParam('message') || getParam('text') || '';
        if (!dmContent.trim()) { logResultado(false, { reason: 'Conteúdo da DM não informado.' }); return { success: false, error: 'Conteúdo da DM não informado.' }; }
        try {
          const _dmStack = new Error().stack;
          logger.info('[DISCORD SEND TRACE]', {
            requestId: null,
            contentPreview: (dmContent || '').substring(0, 80),
            stack: _dmStack,
            file: 'src/ai/toolManager.js',
            function: 'executeToolAction/dm'
          });
          const _dmMsg = await targetMember.send({ content: dmContent });
          logger.info('[DISCORD SEND END]', {
            sentMessageId: _dmMsg?.id,
            method: 'targetMember.send()',
            file: 'src/ai/toolManager.js',
            context: 'direct_message'
          });
        } catch (err) {
          logResultado(false, { reason: `DM bloqueada: ${err.message}` });
          return { success: false, error: `Não foi possível enviar DM para ${targetName}: DMs bloqueadas.` };
        }
        logger.info('[ACTION EXECUTION]', { action: actionType, success: true, target: targetName, arquivo: ARQUIVO });
        logResultado(true, { summary: `DM enviada para ${targetName}.` });
        return { success: true, summary: `DM enviada para ${targetName}.`, contextMessage: `DM enviada.` };
      }

      case 'lock_channel': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          const motivo = 'Canal inválido para trancamento';
          logErro('lock_invalid_channel', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }, { reason });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Canal ${targetChannel.name} trancado.` });
        return { success: true, summary: `Canal ${targetChannel.name} trancado com sucesso.`, contextMessage: `Canal trancado: ${targetChannel.name}.` };
      }

      case 'unlock_channel': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          const motivo = 'Canal inválido para destrancamento';
          logErro('unlock_invalid_channel', motivo);
          logResultado(false, { reason: motivo });
          return { success: false, error: motivo };
        }
        await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }, { reason });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        logResultado(true, { summary: `Canal ${targetChannel.name} destrancado.` });
        return { success: true, summary: `Canal ${targetChannel.name} destrancado com sucesso.`, contextMessage: `Canal destrancado: ${targetChannel.name}.` };
      }

      default: {
        const motivo = `Ação desconhecida: ${parsedAction.action}`;
        logErro('default_case', motivo);
        logResultado(false, { reason: motivo });
        return { success: false, error: motivo };
      }
    }
  } catch (error) {
    // Registra falha de execução para estatísticas
    if (actionType) recordFailure(actionType);

    const motivo = `Falha ao executar a ação: ${error.message}`;
    logger.error('[ACTION ERROR]', {
      origem: 'switch_catch',
      motivo,
      erro: error.message,
      stack: error.stack,
      arquivo: ARQUIVO,
      actionType
    });
    logResultado(false, { reason: motivo });
    return { success: false, error: motivo };
  }
}

module.exports = {
  executeToolAction,
  getMissingParameterStats,
  getActionMetrics,
  resetMissingParameterStats,
  // Exportando funções de estatísticas para uso no novo pipeline
  recordExecution,
  recordFailure
};
