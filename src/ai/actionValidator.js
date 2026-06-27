/**
 * ACTION VALIDATOR
 *
 * Responsável por validar se uma ação pode ser executada, verificando
 * permissões do bot e do usuário.
 *
 * @file src/ai/actionValidator.js
 */

const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

/**
 * @typedef {import('./actionRegistry').Action} Action
 * @typedef {import('discord.js').Message} Message
 */

/**
 * Valida se uma ação pode ser executada.
 * @param {Action} action - O objeto da ação a ser validada.
 * @param {Message} message - A mensagem original que iniciou o comando.
 * @returns {{isValid: boolean, reason: string|null}} - O resultado da validação.
 */
function validateAction(action, message) {
    logger.debug(`[ACTION VALIDATOR] Validando ação: ${action.name}`);

    // 1. Validar permissões do BOT
    if (action.permissions && action.permissions.length > 0) {
        const botMember = message.guild.members.me;
        const missingPerms = action.permissions.filter(perm =>
            !botMember.permissions.has(PermissionFlagsBits[perm])
        );

        if (missingPerms.length > 0) {
            const reason = `Eu não tenho as permissões necessárias para executar esta ação. Falta: ${missingPerms.join(', ')}.`;
            logger.warn('[ACTION FAILED] Validação de permissão do bot falhou.', { action: action.name, missing: missingPerms });
            return { isValid: false, reason };
        }
    }

    // 2. Validar permissões do USUÁRIO
    if (action.userPermissionsCheck) {
        const userHasPermission = action.userPermissionsCheck(message);
        if (!userHasPermission) {
            const reason = 'Você não tem permissão para usar esta ação.';
            logger.warn('[ACTION FAILED] Validação de permissão do usuário falhou.', { action: action.name, user: message.author.tag });
            return { isValid: false, reason };
        }
    }

    // Adicionar outras validações aqui (cooldown, etc.)

    logger.info(`[ACTION VALIDATOR] Ação '${action.name}' validada com sucesso.`);
    return { isValid: true, reason: null };
}

module.exports = { validateAction };