const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const contextManager = require('./contextManager');
const config = require('../config/config');
const { collectResponse, isAdmin, botHasPermission, findChannel } = require('../utils/helpers');

const ACTION_ALIASES = {
  sendmessage: 'send_message',
  send_message: 'send_message',
  send: 'send_message',
  message: 'send_message',
  createembed: 'create_embed',
  create_embed: 'create_embed',
  anuncio: 'create_embed',
  comunicado: 'create_embed',
  evento: 'create_embed',
  atualizacao: 'create_embed',
  atualização: 'create_embed',
  aviso: 'create_embed',
  ban: 'ban_user',
  banir: 'ban_user',
  ban_user: 'ban_user',
  kick: 'kick_user',
  expulsar: 'kick_user',
  kick_user: 'kick_user',
  timeout: 'timeout_user',
  silenciar: 'timeout_user',
  mute: 'timeout_user',
  mute_user: 'timeout_user',
  unmute: 'remove_timeout',
  removesilencio: 'remove_timeout',
  removesilenciar: 'remove_timeout',
  remove_timeout: 'remove_timeout',
  removetimeout: 'remove_timeout',
  warning: 'warn_user',
  warn: 'warn_user',
  advertir: 'warn_user',
  warn_user: 'warn_user',
  remove_warning: 'remove_warning',
  removeradvertencia: 'remove_warning',
  unwarn: 'remove_warning',
  purge: 'purge_messages',
  'apagar mensagens': 'purge_messages',
  'limpar mensagens': 'purge_messages',
  purge_messages: 'purge_messages',
  lock: 'lock_channel',
  trancar: 'lock_channel',
  lock_channel: 'lock_channel',
  unlock: 'unlock_channel',
  destrancar: 'unlock_channel',
  unlock_channel: 'unlock_channel'
};

const DANGEROUS_ACTIONS = new Set([
  'ban_user',
  'kick_user',
  'timeout_user',
  'remove_timeout',
  'purge_messages',
  'lock_channel',
  'unlock_channel'
]);

function normalizeAction(action) {
  if (!action) return null;
  const normalized = action.toString().trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return ACTION_ALIASES[normalized] || normalized;
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
      return 'ManageChannels';
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

function tryParseStructuredResponse(text) {
  if (!text || typeof text !== 'string') return null;

  let candidate = text.trim();
  candidate = candidate.replace(/```json/gi, '').replace(/```/g, '').trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }

  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
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

  const identifiers = [parsed.target_member, parsed.target_user, parsed.user_id, parsed.target, parsed.member].filter(Boolean);
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
  await message.channel.send({ content: confirmationText });

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
}

async function executeToolAction(parsedAction, message) {
  if (!parsedAction || typeof parsedAction !== 'object' || !parsedAction.action) {
    return { success: false, error: 'Ação inválida retornada pela IA.' };
  }

  if (!config.FEATURES.ADMIN_COMMANDS_ENABLED) {
    return { success: false, error: 'Comandos administrativos estão desativados.' };
  }

  if (!isAdmin(message.member)) {
    return { success: false, error: 'Apenas administradores podem executar ações administrativas.' };
  }

  const actionType = normalizeAction(parsedAction.action);
  const targetChannel = resolveChannel(parsedAction.channel || parsedAction.channel_name || parsedAction.channel_id, message);
  const targetMember = await resolveTargetMember(parsedAction, message);
  const reason = parsedAction.reason || parsedAction.motivo || parsedAction.reason || 'Sem motivo especificado.';
  const count = Number(parsedAction.count || parsedAction.amount || parsedAction.limit || 0) || 0;
  const duration = parseDuration(parsedAction.duration || parsedAction.time || parsedAction.tempo || parsedAction.length || parsedAction.duration_ms || 0);
  const confirmationRequired = DANGEROUS_ACTIONS.has(actionType);
  const targetName = simplifyTargetName(targetMember, parsedAction);

  const requiredPermission = getPermissionForAction(actionType);
  if (requiredPermission && !botHasPermission(targetChannel, message.client, requiredPermission)) {
    return { success: false, error: `Não tenho permissão ${requiredPermission} para executar esta ação.` };
  }

  if (confirmationRequired) {
    const description = formatConfirmation(actionType, targetName, reason, count ? `Quantidade: ${count}.` : '');
    const confirmed = await requestConfirmation(message, description);
    if (!confirmed) {
      return { success: false, summary: 'Ação cancelada pelo usuário.' };
    }
  }

  try {
    switch (actionType) {
      case 'send_message': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          return { success: false, error: 'Canal de destino inválido para enviar mensagem.' };
        }

        const content = parsedAction.message || parsedAction.text || parsedAction.body || '';
        if (!content.trim()) {
          return { success: false, error: 'Conteúdo da mensagem não foi fornecido.' };
        }

        await targetChannel.send({ content });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Mensagem enviada com sucesso em ${targetChannel}.`,
          contextMessage: `Mensagem enviada em ${targetChannel}.`
        };
      }

      case 'create_embed': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          return { success: false, error: 'Canal de destino inválido para criar o embed.' };
        }

        const embed = buildStructuredEmbed(parsedAction);
        if (!embed.data.title && !embed.data.description) {
          return { success: false, error: 'Embed inválido gerado pela IA.' };
        }

        await targetChannel.send({ embeds: [embed] });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Embed enviado com sucesso em ${targetChannel}.`,
          contextMessage: `Embed enviado em ${targetChannel}.`
        };
      }

      case 'ban_user': {
        if (!targetMember) {
          return { success: false, error: 'Membro alvo não encontrado para banimento.' };
        }
        if (!targetMember.bannable) {
          return { success: false, error: 'Não posso banir esse usuário. Verifique minha hierarquia de cargos.' };
        }

        await targetMember.ban({ reason });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Usuário ${targetName} banido com sucesso.`,
          contextMessage: `Usuário banido: ${targetName}.`
        };
      }

      case 'kick_user': {
        if (!targetMember) {
          return { success: false, error: 'Membro alvo não encontrado para expulsão.' };
        }
        if (!targetMember.kickable) {
          return { success: false, error: 'Não posso expulsar esse usuário. Verifique minha hierarquia de cargos.' };
        }

        await targetMember.kick(reason);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Usuário ${targetName} expulso com sucesso.`,
          contextMessage: `Usuário expulso: ${targetName}.`
        };
      }

      case 'timeout_user': {
        if (!targetMember) {
          return { success: false, error: 'Membro alvo não encontrado para silenciamento.' };
        }
        if (!duration) {
          return { success: false, error: 'Duração inválida para timeout.' };
        }

        await targetMember.timeout(duration, reason);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Usuário ${targetName} silenciado por ${Math.round(duration / 60000)} minuto(s).`,
          contextMessage: `Timeout aplicado para ${targetName}.`
        };
      }

      case 'remove_timeout': {
        if (!targetMember) {
          return { success: false, error: 'Membro alvo não encontrado para remoção de timeout.' };
        }

        await targetMember.timeout(null, reason);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Timeout removido de ${targetName}.`,
          contextMessage: `Timeout removido de ${targetName}.`
        };
      }

      case 'warn_user': {
        if (!targetMember) {
          return { success: false, error: 'Membro alvo não encontrado para advertência.' };
        }

        const warningMessage = `Você recebeu uma advertência no servidor ${message.guild.name}. Motivo: ${reason}`;
        try {
          await targetMember.send({ content: warningMessage });
        } catch (error) {
          logger.warn('⚠️ Não foi possível enviar aviso por DM', { target: targetName, error: error.message });
        }

        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Advertência registrada para ${targetName}.`,
          contextMessage: `Advertência aplicada em ${targetName}.`
        };
      }

      case 'remove_warning': {
        if (!targetMember) {
          return { success: false, error: 'Membro alvo não encontrado para remover advertência.' };
        }

        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Remoção de advertência registrada para ${targetName}.`,
          contextMessage: `Advertência removida de ${targetName}.`
        };
      }

      case 'purge_messages': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          return { success: false, error: 'Canal inválido para limpar mensagens.' };
        }
        if (!count || count <= 0) {
          return { success: false, error: 'Quantidade de mensagens inválida para exclusão.' };
        }

        const limit = Math.min(count, 100);
        const messages = await targetChannel.messages.fetch({ limit });
        await targetChannel.bulkDelete(messages, true);
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Limpeza concluída: ${messages.size} mensagem(s) apagada(s) em ${targetChannel}.`,
          contextMessage: `Mensagens apagadas em ${targetChannel}.`
        };
      }

      case 'lock_channel': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          return { success: false, error: 'Canal inválido para trancamento.' };
        }

        await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
          SendMessages: false
        }, { reason });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Canal ${targetChannel.name} trancado com sucesso.`,
          contextMessage: `Canal trancado: ${targetChannel.name}.`
        };
      }

      case 'unlock_channel': {
        if (!targetChannel || !targetChannel.isTextBased()) {
          return { success: false, error: 'Canal inválido para destrancamento.' };
        }

        await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
          SendMessages: null
        }, { reason });
        await logAudit(parsedAction, message, targetMember, targetChannel, reason);
        return {
          success: true,
          summary: `Canal ${targetChannel.name} destrancado com sucesso.`,
          contextMessage: `Canal destrancado: ${targetChannel.name}.`
        };
      }

      default:
        return { success: false, error: `Ação desconhecida: ${parsedAction.action}` };
    }
  } catch (error) {
    logger.error('❌ Falha ao executar ação administrativa', { action: parsedAction.action, error: error.message });
    return { success: false, error: `Falha ao executar a ação: ${error.message}` };
  }
}

module.exports = {
  tryParseStructuredResponse,
  executeToolAction
};
