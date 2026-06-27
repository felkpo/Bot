/**
 * ACTION EXECUTOR
 *
 * Este módulo contém a implementação real de todas as ações que a IA pode executar.
 * Ele é o único local autorizado a interagir com a API do Discord, managers, etc.,
 * para realizar uma tarefa.
 *
 * Cada função exportada corresponde a uma ação registrada no `actionRegistry`.
 *
 * @file src/ai/actionExecutor.js
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../utils/logger');
const { isAdmin, resolveTarget } = require('../utils/helpers');

// Importar todos os managers necessários
const userGroupManager = require('../managers/userGroupManager');
const testerUsageManager = require('../managers/testerUsageManager');
const auditMemoryManager = require('../managers/auditMemoryManager');

/**
 * Extrai o ID de uma menção de usuário, cargo ou canal.
 * @param {string} mention - A menção (ex: <@123>, <#123>, <@&123>).
 * @returns {string} O ID puro.
 */
function _extractId(mention) {
    return mention.replace(/[<@#&!>]/g, '');
}

// --- Ações de Mensagens ---

async function sendMessage(args, message) {
    const channelId = _extractId(args.channel);
    const targetChannel = await message.guild.channels.fetch(channelId).catch(() => null);
    if (!targetChannel || !targetChannel.isTextBased()) {
        throw new Error('Canal de destino inválido ou não é um canal de texto.');
    }
    await targetChannel.send(args.content);
    logger.info('[ACTION EXECUTION] sendMessage', { channel: targetChannel.name, content: args.content });
    return `Mensagem enviada com sucesso para o canal ${targetChannel.toString()}.`;
}

// --- Ações de Moderação ---

async function banUser(args, message) {
    const userId = _extractId(args.user);
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) throw new Error('Membro não encontrado.');
    if (!member.bannable) throw new Error('Não tenho permissão para banir este membro.');

    const reason = args.reason || `Banido por ${message.author.tag} via IA.`;
    await member.ban({ reason });
    logger.info('[ACTION EXECUTION] banUser', { user: member.user.tag, reason });
    return `Usuário ${member.user.tag} banido com sucesso.`;
}

async function kickUser(args, message) {
    const userId = _extractId(args.user);
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) throw new Error('Membro não encontrado.');
    if (!member.kickable) throw new Error('Não tenho permissão para expulsar este membro.');

    const reason = args.reason || `Expulso por ${message.author.tag} via IA.`;
    await member.kick(reason);
    logger.info('[ACTION EXECUTION] kickUser', { user: member.user.tag, reason });
    return `Usuário ${member.user.tag} expulso com sucesso.`;
}

async function purgeMessages(args, message) {
    const count = parseInt(args.count, 10);
    if (isNaN(count) || count < 2 || count > 100) {
        throw new Error('A quantidade de mensagens para apagar deve ser um número entre 2 e 100.');
    }
    const channelId = args.channel ? _extractId(args.channel) : message.channel.id;
    const targetChannel = message.guild.channels.cache.get(channelId);
    if (!targetChannel || !targetChannel.isTextBased()) {
        throw new Error('Canal inválido.');
    }
    const deleted = await targetChannel.bulkDelete(count, true);
    logger.info('[ACTION EXECUTION] purgeMessages', { channel: targetChannel.name, count: deleted.size });
    return `${deleted.size} mensagens foram apagadas em ${targetChannel.toString()}.`;
}

// --- Ações de Grupo de Usuários ---

async function setUserGroup(args, message) {
    const { action, group } = args;
    const userId = _extractId(args.user);
    const targetUser = await message.guild.members.fetch(userId).catch(() => null);
    if (!targetUser) throw new Error('Usuário não encontrado.');

    let result;
    if (action.toLowerCase() === 'add') {
        result = userGroupManager.addUser(group, targetUser.id);
    } else if (action.toLowerCase() === 'remove') {
        result = userGroupManager.removeUser(group, targetUser.id);
    } else {
        throw new Error("Ação inválida. Use 'add' ou 'remove'.");
    }

    if (!result.success) throw new Error(result.message);
    logger.info('[ACTION EXECUTION] setUserGroup', { action, group, user: targetUser.user.tag });
    return result.message;
}

async function listGroupMembers(args, message) {
    const { group } = args;
    if (!userGroupManager.resolveGroupKey(group)) {
        throw new Error(`Grupo '${group}' inválido. Grupos disponíveis: ${Object.keys(userGroupManager.GROUP_ALIASES).join(', ')}`);
    }
    const members = userGroupManager.getGroup(group);
    if (members.length === 0) return `O grupo '${group}' não tem membros.`;

    const memberList = await Promise.all(members.map(async id => {
        try {
            const user = await message.client.users.fetch(id);
            return `- ${user.tag} (\`${id}\`)`;
        } catch {
            return `- Usuário não encontrado (\`${id}\`)`;
        }
    }));

    logger.info('[ACTION EXECUTION] listGroupMembers', { group });
    return `Membros do grupo '${group}':\n${memberList.join('\n')}`;
}

// --- Ações de Testers ---

async function setTesterUsage(args, message) {
    const userId = _extractId(args.user);
    const amount = parseInt(args.amount, 10);
    if (isNaN(amount) || amount < 0) {
        throw new Error('A quantidade deve ser um número positivo.');
    }
    testerUsageManager.setUsage(userId, amount, message.author.id);
    logger.info('[ACTION EXECUTION] setTesterUsage', { user: userId, amount });
    return `O uso do tester <@${userId}> foi definido para ${amount}.`;
}

// --- Ações de Auditoria ---

async function queryAudit(args, message) {
    const limit = args.limit || 10;
    let events;
    let title;

    switch (args.filter_type.toLowerCase()) {
        case 'recent':
            events = auditMemoryManager.getRecentEvents(message.guild.id, limit);
            title = `Últimos ${events.length} eventos de auditoria:`;
            break;
        case 'user': {
            const target = await resolveTarget(message.guild, args.filter_value, 'user');
            if (!target) throw new Error(`Usuário '${args.filter_value}' não encontrado.`);
            events = auditMemoryManager.getUserEvents(message.guild.id, target.id, limit);
            title = `Últimos ${events.length} eventos para o usuário ${target.name}:`;
            break;
        }
        // Adicionar mais casos para role, channel, etc.
        default:
            throw new Error(`Tipo de filtro de auditoria inválido: '${args.filter_type}'. Use 'recent', 'user', 'role', 'channel'.`);
    }

    if (events.length === 0) return 'Nenhum evento de auditoria encontrado para este filtro.';

    const eventList = events.map(e => `\`${new Date(e.timestamp).toLocaleString()}\` - **${e.action}** por <@${e.executorId}>`).join('\n');
    logger.info('[ACTION EXECUTION] queryAudit', { filter: args.filter_type, value: args.filter_value });
    return `${title}\n${eventList}`;
}

module.exports = {
    sendMessage,
    banUser,
    kickUser,
    purgeMessages,
    setUserGroup,
    listGroupMembers,
    setTesterUsage,
    queryAudit,
};