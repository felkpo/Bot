const { Events, ChannelType } = require('discord.js');
const crypto = require('crypto');
const logger = require('../utils/logger');
const aiProvider = require('../ai/provider');
const contextManager = require('../ai/contextManager');
const { shouldActivateAI, stripPrefix, UNIVERSAL_ACTION_VERBS_REGEX } = require('../utils/regex');
const { getActionsForPrompt } = require('../ai/actionRegistry');
const { resolveAction } = require('../ai/actionResolver');
const { validateAction } = require('../ai/actionValidator');
const actionExecutor = require('../ai/actionExecutor');
const { tryParseStructuredResponse } = require('../ai/toolManager'); // Apenas para parsing
const config = require('../config/config');
const userGroupManager = require('../managers/userGroupManager');
const testerUsageManager = require('../managers/testerUsageManager');
const guildSettingsManager = require('../managers/guildSettingsManager');
const auditMemoryManager = require('../managers/auditMemoryManager');
const { generateHelpEmbed } = require('../utils/helpGenerator');
const { resolveTarget } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

// Timeout de diagnóstico por etapa (5 segundos)
const DIAGNOSTIC_TIMEOUT = 5000;

// Helper para criar timeout de diagnóstico
function createDiagnosticTimeout(stepName, startTime) {
  return setTimeout(() => {
    const elapsed = Date.now() - startTime;
    logger.warn(`⚠️ [WARN] Etapa "${stepName}" demorando mais de ${DIAGNOSTIC_TIMEOUT / 1000}s - ${elapsed}ms decorridos`);
  }, DIAGNOSTIC_TIMEOUT);
}

/**
 * [TESTE DE ISOLAMENTO] Envia mensagem usando reply() ou channel.send() baseado na flag USE_CHANNEL_SEND
 * Captura tempo de execução, erro completo e stack trace
 * @param {Object} message - Objeto message do Discord.js
 * @param {string|Object} content - Conteúdo da mensagem
 * @param {string} context - Contexto para logs (ex: "resposta única", "chunk 1/3", "ação bem-sucedida")
 * @returns {Promise<Object>} Resultado da operação com tempo e status
 */
async function sendDiscordMessage(message, content, context = 'genérico', requestId = null) {
  const startTime = Date.now();
  const method = config.USE_CHANNEL_SEND ? 'channel.send()' : 'message.reply()';
  const fileLocation = 'src/events/messageCreate.js';
  const contentPreview = typeof content === 'string'
    ? content.substring(0, 80)
    : (content?.content || '').substring(0, 80);

  const sendStack = new Error().stack;
  logger.info('[DISCORD SEND TRACE]', {
    requestId,
    contentPreview,
    stack: sendStack,
    file: fileLocation
  });

  logger.info('[DISCORD SEND START]', {
    requestId,
    method,
    file: fileLocation,
    context,
    contentPreview,
    contentLength: typeof content === 'string' ? content.length : (content?.content || '').length
  });

  try {
    let result;
    if (config.USE_CHANNEL_SEND) {
      if (typeof content === 'string') {
        result = await message.channel.send(content);
      } else {
        result = await message.channel.send(content);
      }
    } else {
      if (typeof content === 'string') {
        result = await message.reply({
          content: content,
          allowedMentions: { repliedUser: false }
        });
      } else {
        result = await message.reply(content);
      }
    }
    
    const totalTime = Date.now() - startTime;
    logger.info('[DISCORD SEND END]', {
      requestId,
      sentMessageId: result?.id,
      method,
      file: fileLocation,
      context,
      tempoMs: totalTime
    });

    return {
      success: true,
      tempoMs: totalTime,
      metodo: method,
      arquivo: fileLocation,
      contexto: context,
      result: result
    };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('[DISCORD SEND ERROR]', {
      requestId,
      method,
      file: fileLocation,
      context,
      error: error.message,
      code: error.code,
      tempoMs: totalTime,
      stack: error.stack
    });
    throw error;
  }
}

// Proteção contra processamento duplicado de mensagens
const processedMessages = new Set();

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const flowStartTime = Date.now();

    // ══════════════════════════════════════════════════════════════════════
    // FILTROS ABSOLUTOS — executados ANTES de qualquer lógica, log ou IA
    // ══════════════════════════════════════════════════════════════════════

    logger.info('[EVENT ENTRY]', {
      messageId: message.id,
      arquivo: 'src/events/messageCreate.js'
    });

    logger.info('[MESSAGE AUTHOR CHECK]', {
      authorTag: message.author?.tag,
      authorId: message.author?.id,
      bot: message.author?.bot,
      system: message.system,
      arquivo: 'src/events/messageCreate.js'
    });

    // Bloqueia mensagens do próprio bot (PRIMEIRO check absoluto)
    if (message.author?.bot) {
      logger.info('[BOT MESSAGE IGNORED]', {
        author: message.author.tag,
        authorId: message.author.id,
        arquivo: 'src/events/messageCreate.js'
      });
      return;
    }

    // Bloqueia webhooks
    if (message.webhookId) {
      logger.info('[WEBHOOK MESSAGE IGNORED]', {
        webhookId: message.webhookId,
        arquivo: 'src/events/messageCreate.js'
      });
      return;
    }

    // Bloqueia mensagens de sistema
    if (message.system) {
      logger.info('[SYSTEM MESSAGE IGNORED]', {
        arquivo: 'src/events/messageCreate.js'
      });
      return;
    }

    // Ignora DMs
    if (message.channel.type === ChannelType.DM) {
      logger.debug('💌 DM ignorada', { author: message.author.tag });
      return;
    }

    // Verificar quantidade de listeners registrados
    const listenerCount = message.client?.listenerCount?.('messageCreate') ?? 'desconhecido';
    logger.info('[MESSAGE LISTENER COUNT]', {
      count: listenerCount,
      messageId: message.id,
      arquivo: 'src/events/messageCreate.js'
    });

    // Proteção contra duplicatas — evita processar a mesma mensagem duas vezes
    if (processedMessages.has(message.id)) {
      logger.warn('[DUPLICATE RESPONSE GUARD]', {
        messageId: message.id,
        author: message.author?.tag,
        arquivo: 'src/events/messageCreate.js'
      });
      return;
    }
    processedMessages.add(message.id);
    // Remove da cache após 5 minutos para não vazar memória
    setTimeout(() => {
      processedMessages.delete(message.id);
    }, 300000);

    logger.info('[MESSAGE EXECUTION START]', {
      messageId: message.id,
      author: message.author?.tag,
      arquivo: 'src/events/messageCreate.js'
    });

    const requestId = crypto.randomUUID();
    logger.info('[REQUEST START]', {
      requestId,
      messageId: message.id,
      userId: message.author.id,
      arquivo: 'src/events/messageCreate.js'
    });

    try {
      const content = message.content;
      const isMentioned = message.mentions.has(message.client.user.id);

      logger.debug('[DEBUG] PASSO 1 - Mensagem recebida', {
        content: content.substring(0, 50),
        author: message.author.tag,
        channel: message.channel.name,
        isMentioned: isMentioned
      });

      // Verifica se deve ativar IA
      logger.debug('[DEBUG] PASSO 2 - Verificando trigger...');
      const step2Start = Date.now();
      const step2Timeout = createDiagnosticTimeout('verificação de trigger', step2Start);
      
      const shouldActivate = shouldActivateAI(content, isMentioned, message);
      clearTimeout(step2Timeout);

      logger.info('[TRIGGER RESULT]', {
        triggerAccepted: shouldActivate,
        messageId: message.id,
        requestId,
        arquivo: 'src/events/messageCreate.js'
      });

      if (!shouldActivate) {
        logger.info('[TRIGGER BLOCKED]', {
          messageId: message.id,
          requestId,
          reason: 'no_prefix_no_mention',
          arquivo: 'src/events/messageCreate.js'
        });
        return;
      }

      // Variáveis de mensagem normalizadas, declaradas uma única vez para reutilização.
      const userMessage = stripPrefix(content);
      const lowerMessage = userMessage.toLowerCase().trim();

      // ══════════════════════════════════════════════════════════════════════
      // AI ACCESS CONTROL — auditoria de acesso
      // ══════════════════════════════════════════════════════════════════════
      const ADMIN_USERS = (process.env.ADMIN_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
      const isAdminUser = message.member?.permissions?.has('Administrator') || ADMIN_USERS.includes(message.author.id) || userGroupManager.hasUser('admintester', message.author.id);      const role = userGroupManager.getUserRole(message.author.id);

      logger.info('[ROLE RESOLUTION]', {
        userId: message.author.id,
        role: role
      });

      const allowedRoles = [
        'akira',
        'servant',
        'tester',
        'admintester'
      ];

      const isAllowed = isAdminUser || allowedRoles.includes(role);

      logger.info('[ACCESS ROLE CHECK]', {
        userId: message.author.id,
        role: role,
        isAdmin: isAdminUser,
        isTester: role === 'tester',
        isAdminTester: role === 'admintester',
        allowed: isAllowed
      });

      if (!isAllowed) {
        logger.info('[ACCESS DENIED REASON]', {
          userId: message.author.id,
          role: role,
          reason: 'role_not_allowed'
        });
        return;
      }

      logger.info('[AI ACCESS GRANTED]', {
        userId: message.author.id,
        role: role
      });

      logger.debug('[DEBUG] Trigger ativada');

      // ══════════════════════════════════════════════════════════════════════
      // COMANDOS DE ADMIN — gerenciamento de user groups
      // ══════════════════════════════════════════════════════════════════════
      const cmdParts = lowerMessage.split(/\s+/);
      const cmd = cmdParts[0] || '';

      // Helper para extrair userId de menção ou ID direto
      function extractUserId(input) {
        if (!input) return null;
        // Menção do Discord: <@123456789> ou <@!123456789>
        const mentionMatch = input.match(/^<@!?(\d+)>$/);
        if (mentionMatch) return mentionMatch[1];
        // ID numérico direto
        if (/^\d{17,20}$/.test(input)) return input;
        return null;
      }

      // add <grupo> <@usuario|ID>
      if (cmd === 'add' && cmdParts.length >= 3) {
        const groupName = cmdParts[1].toLowerCase();
        const targetId = extractUserId(cmdParts[2]);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido. Use @menção ou o ID numérico.').catch(() => {});
          return;
        }
        const result = userGroupManager.addUser(groupName, targetId);
        await message.reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`).catch(() => {});
        return;
      }

      // remove <grupo> <@usuario|ID>
      if (cmd === 'remove' && cmdParts.length >= 3) {
        const groupName = cmdParts[1].toLowerCase();
        const targetId = extractUserId(cmdParts[2]);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido. Use @menção ou o ID numérico.').catch(() => {});
          return;
        }
        const result = userGroupManager.removeUser(groupName, targetId);
        await message.reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`).catch(() => {});
        return;
      }

      // role <@usuario|ID>
      if (cmd === 'role' && cmdParts.length >= 2) {
        const targetId = extractUserId(cmdParts[1]);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido. Use @menção ou o ID numérico.').catch(() => {});
          return;
        }
        const role = userGroupManager.getUserRole(targetId);
        const tag = message.mentions.users.first()?.tag || targetId;
        await message.reply(`**Usuário:** ${tag}\n**Role:** ${role}`).catch(() => {});
        return;
      }

      // list <grupo>
      if (cmd === 'list' && cmdParts.length >= 2) {
        const groupName = cmdParts[1].toLowerCase();
        const groupKey = userGroupManager.resolveGroupKey(groupName);
        if (!groupKey) {
          await message.reply('❌ Grupo inválido. Grupos: akira, servant, tester, admintester').catch(() => {});
          return;
        }
        const members = userGroupManager.getGroup(groupName);
        if (members.length === 0) {
          await message.reply(`📭 Grupo "${groupName}" está vazio.`).catch(() => {});
          return;
        }
        const formatted = members.map(id => `• <@${id}> (${id})`).join('\n');
        await message.reply(`**${groupKey}** (${members.length}):\n${formatted}`).catch(() => {});
        return;
      }

      // debug role — mostra role do próprio usuário
      if (cmd === 'debug' && cmdParts[1] === 'role') {
        const role = userGroupManager.getUserRole(message.author.id);
        const personalityMap = {
          admintester: 'tester',
          tester: 'tester',
          servant: 'servant',
          default: 'default'
        };
        await message.reply(
          `**User ID:** ${message.author.id}\n` +
          `**Role:** ${role}\n` +
          `**Personality:** ${personalityMap[role] || 'default'}`
        ).catch(() => {});
        return;
      }

      // debug actions — lista actions registradas
      if (cmd === 'debug' && cmdParts[1] === 'actions') {
        const allGroups = userGroupManager.getAllGroups();
        const totalUsers = Object.values(allGroups).reduce((a, b) => a + b.length, 0);
        await message.reply(
          `**User Groups** (${totalUsers} membros no total):\n` +
          `• akira: ${allGroups.akiraUsers.length}\n` +
          `• servant: ${allGroups.servantUsers.length}\n` +
          `• testers: ${allGroups.testers.length}\n` +
          `• admin_testers: ${allGroups.adminTesters.length}\n\n` +
          `**Comandos disponíveis:**\n` +
          `• rp add <grupo> @user — adiciona a grupo\n` +
          `• rp remove <grupo> @user — remove de grupo\n` +
          `• rp role @user — mostra role\n` +
          `• rp list <grupo> — lista membros\n` +
          `• rp debug role — debug do role\n` +
          `• rp debug access @user — debug de acesso à IA\n` +
          `• rp tester usage @user — uso do tester\n` +
          `• rp tester reset @user — zera usos\n` +
          `• rp debug actions — este comando\n` +
          `• rp debug memory — contexto do servidor`
        ).catch(() => {});
        return;
      }

      // debug access <@usuario|ID>
      if (cmd === 'debug' && cmdParts[1] === 'access' && cmdParts.length >= 3) {
        const targetId = extractUserId(cmdParts[2]);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido.').catch(() => {});
          return;
        }
        const targetRole = userGroupManager.getUserRole(targetId);
        const isAdminT = ADMIN_USERS.includes(targetId); // we assume no guild access for mention check right here
        const allowedRs = ['akira', 'servant', 'tester', 'admintester'];
        const isAllowedT = isAdminT || allowedRs.includes(targetRole);
        let reason = isAdminT ? 'admin' : (allowedRs.includes(targetRole) ? targetRole : 'role_not_allowed');
        await message.reply(
          `**User ID:** ${targetId}\n` +
          `**Role:** ${targetRole}\n` +
          `**Is Admin:** ${isAdminT}\n` +
          `**Can Use AI:** ${isAllowedT}\n` +
          `**Reason:** ${reason}`
        ).catch(() => {});
        return;
      }

      // tester usage [@usuario|ID]
      if (cmd === 'tester' && cmdParts[1] === 'usage') {
        const targetId = cmdParts.length >= 3 ? extractUserId(cmdParts[2]) : message.author.id;
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido.').catch(() => {});
          return;
        }

        logger.info('[TESTER ADMIN CHECK]', {
          userId: message.author.id,
          command: 'tester usage',
          isAdmin: isAdminUser
        });

        // Só pode ver uso de outros se for admin
        if (targetId !== message.author.id && !isAdminUser) {
          logger.info('[TESTER ACCESS DENIED]', {
            userId: message.author.id,
            command: 'tester usage'
          });
          await message.reply('❌ Você não tem permissão para usar este comando.').catch(() => {});
          return;
        }

        logger.info('[TESTER ACCESS GRANTED]', {
          userId: message.author.id,
          command: 'tester usage'
        });

        const usage = testerUsageManager.getUsage(targetId);
        const remaining = testerUsageManager.getRemaining(targetId);
        const tag = targetId === message.author.id ? message.author.tag : (message.mentions.users.first()?.tag || targetId);
        await message.reply(
          `**Usuário:** ${tag}\n` +
          `**Uso hoje:** ${usage}/10\n` +
          `**Restantes:** ${remaining}\n` +
          `**Limite:** 10`
        ).catch(() => {});
        return;
      }

      // tester reset <@usuario|ID>
      if (cmd === 'tester' && cmdParts[1] === 'reset' && cmdParts.length >= 3) {
        logger.info('[TESTER ADMIN CHECK]', {
          userId: message.author.id,
          command: 'tester reset',
          isAdmin: isAdminUser
        });

        if (!isAdminUser) {
          logger.info('[TESTER ACCESS DENIED]', {
            userId: message.author.id,
            command: 'tester reset'
          });
          await message.reply('❌ Você não tem permissão para usar este comando.').catch(() => {});
          return;
        }

        logger.info('[TESTER ACCESS GRANTED]', {
          userId: message.author.id,
          command: 'tester reset'
        });

        const targetId = extractUserId(cmdParts[2]);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido.').catch(() => {});
          return;
        }
        testerUsageManager.resetUser(targetId);
        const tag = message.mentions.users.first()?.tag || targetId;
        logger.info('[TESTER RESET]', {
          admin: message.author.id,
          target: targetId
        });
        await message.reply(`✅ Usos de **${tag}** foram zerados.`).catch(() => {});
        return;
      }

      // tester addusage <@usuario|ID> <quantidade>
      if (cmd === 'tester' && cmdParts[1] === 'addusage' && cmdParts.length >= 4) {
        logger.info('[TESTER ADMIN CHECK]', {
          userId: message.author.id,
          command: 'tester addusage',
          isAdmin: isAdminUser
        });

        if (!isAdminUser) {
          logger.info('[TESTER ACCESS DENIED]', {
            userId: message.author.id,
            command: 'tester addusage'
          });
          await message.reply('❌ Você não tem permissão para usar este comando.').catch(() => {});
          return;
        }

        logger.info('[TESTER ACCESS GRANTED]', {
          userId: message.author.id,
          command: 'tester addusage'
        });

        const targetId = extractUserId(cmdParts[2]);
        const amount = parseInt(cmdParts[3], 10);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido.').catch(() => {});
          return;
        }
        if (isNaN(amount) || amount <= 0) {
          await message.reply('❌ Quantidade inválida.').catch(() => {});
          return;
        }
        const current = testerUsageManager.addUsage(targetId, amount, message.author.id);
        const tag = message.mentions.users.first()?.tag || targetId;
        await message.reply(`✅ Adicionado ${amount} usos para **${tag}**. Novo total: ${current}/10.`).catch(() => {});
        return;
      }

      // tester removeusage <@usuario|ID> <quantidade>
      if (cmd === 'tester' && cmdParts[1] === 'removeusage' && cmdParts.length >= 4) {
        logger.info('[TESTER ADMIN CHECK]', {
          userId: message.author.id,
          command: 'tester removeusage',
          isAdmin: isAdminUser
        });

        if (!isAdminUser) {
          logger.info('[TESTER ACCESS DENIED]', {
            userId: message.author.id,
            command: 'tester removeusage'
          });
          await message.reply('❌ Você não tem permissão para usar este comando.').catch(() => {});
          return;
        }

        logger.info('[TESTER ACCESS GRANTED]', {
          userId: message.author.id,
          command: 'tester removeusage'
        });

        const targetId = extractUserId(cmdParts[2]);
        const amount = parseInt(cmdParts[3], 10);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido.').catch(() => {});
          return;
        }
        if (isNaN(amount) || amount <= 0) {
          await message.reply('❌ Quantidade inválida.').catch(() => {});
          return;
        }
        const current = testerUsageManager.removeUsage(targetId, amount, message.author.id);
        const tag = message.mentions.users.first()?.tag || targetId;
        await message.reply(`✅ Removido ${amount} usos de **${tag}**. Novo total: ${current}/10.`).catch(() => {});
        return;
      }

      // tester setusage <@usuario|ID> <quantidade>
      if (cmd === 'tester' && cmdParts[1] === 'setusage' && cmdParts.length >= 4) {
        logger.info('[TESTER ADMIN CHECK]', {
          userId: message.author.id,
          command: 'tester setusage',
          isAdmin: isAdminUser
        });

        if (!isAdminUser) {
          logger.info('[TESTER ACCESS DENIED]', {
            userId: message.author.id,
            command: 'tester setusage'
          });
          await message.reply('❌ Você não tem permissão para usar este comando.').catch(() => {});
          return;
        }

        logger.info('[TESTER ACCESS GRANTED]', {
          userId: message.author.id,
          command: 'tester setusage'
        });

        const targetId = extractUserId(cmdParts[2]);
        const amount = parseInt(cmdParts[3], 10);
        if (!targetId) {
          await message.reply('❌ ID de usuário inválido.').catch(() => {});
          return;
        }
        if (isNaN(amount) || amount < 0) {
          await message.reply('❌ Quantidade inválida.').catch(() => {});
          return;
        }
        const current = testerUsageManager.setUsage(targetId, amount, message.author.id);
        const tag = message.mentions.users.first()?.tag || targetId;
        await message.reply(`✅ Usos de **${tag}** definidos para ${current}/10.`).catch(() => {});
        return;
      }

      // quickpunishment
      if (cmd === 'quickpunishment' && cmdParts[1]) {
        if (!isAdminUser) {
          await message.reply('❌ Você não tem permissão para gerenciar o QuickPunishment.').catch(() => {});
          return;
        }
        const action = cmdParts[1].toLowerCase();

        if (action === 'on') {
          guildSettingsManager.setQuickPunishmentEnabled(message.guildId, true);
          await message.reply('⚡ QuickPunishment ativado para este servidor.').catch(() => {});
          return;
        }

        if (action === 'off') {
          guildSettingsManager.setQuickPunishmentEnabled(message.guildId, false);
          await message.reply('🐢 QuickPunishment desativado para este servidor.').catch(() => {});
          return;
        }

        if (action === 'toggle') {
          const newState = guildSettingsManager.toggleQuickPunishment(message.guildId);
          const statusText = newState ? 'ATIVADO' : 'DESATIVADO';
          await message.reply(`QuickPunishment foi alterado para: **${statusText}**.`).catch(() => {});
          return;
        }

        if (action === 'status') {
          const status = guildSettingsManager.isQuickPunishmentEnabled(message.guildId) ? 'ATIVADO' : 'DESATIVADO';
          await message.reply(`QuickPunishment está atualmente **${status}**.`).catch(() => {});
          return;
        }

        await message.reply('Comando QuickPunishment inválido. Use `on`, `off`, `toggle` ou `status`.').catch(() => {});
        return;
      }

      // rp audit — Sistema de Auditoria
      if (cmd === 'audit') {
        if (!isAdminUser) {
          await message.reply('❌ Você não tem permissão para acessar a auditoria.').catch(() => {});
          return;
        }
        const subcmd = cmdParts[1]?.toLowerCase();
        const rawTargetInput = cmdParts.slice(2).join(' ');

        if (subcmd === 'recent') {
          const events = auditMemoryManager.getRecentEvents(message.guildId, 10);
          if (!events.length) {
            await message.reply('Não há eventos recentes na auditoria.').catch(() => {});
            return;
          }
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Alvo: ${e.targetId || e.targetBotId || 'N/A'})`).join('\n');
          await message.reply(`**Últimos 10 eventos:**\n${text}`).catch(() => {});
          return;
        }

        if (subcmd === 'user' && rawTargetInput) {
          const target = await resolveTarget(message.guild, rawTargetInput, 'user');
          if (!target) return message.reply('Usuário não encontrado.');
          logger.info('[AUDIT TARGET RESOLVED]', { input: rawTargetInput, resolvedType: 'user', resolvedId: target.id });
          const events = auditMemoryManager.getUserEvents(message.guildId, target.id, 10);
          if (!events.length) return message.reply('Nenhum evento encontrado para este usuário.');
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Alvo: <@${e.targetId}>)`).join('\n');
          return message.reply(`**Últimos eventos do usuário ${target.name} (<@${target.id}>):**\n${text}`);
        }

        if (subcmd === 'role' && rawTargetInput) {
          const target = await resolveTarget(message.guild, rawTargetInput, 'role');
          if (!target) return message.reply('Cargo não encontrado.');
          logger.info('[AUDIT TARGET RESOLVED]', { input: rawTargetInput, resolvedType: 'role', resolvedId: target.id });
          const events = auditMemoryManager.getRoleEvents(message.guildId, target.id, 10);
          if (!events.length) return message.reply('Nenhum evento encontrado para este cargo.');
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Alvo: <@&${e.targetId}>)`).join('\n');
          return message.reply(`**Últimos eventos do cargo ${target.name} (<@&${target.id}>):**\n${text}`);
        }

        if (subcmd === 'channel' && rawTargetInput) {
          const target = await resolveTarget(message.guild, rawTargetInput, 'channel');
          if (!target) return message.reply('Canal não encontrado.');
          logger.info('[AUDIT TARGET RESOLVED]', { input: rawTargetInput, resolvedType: 'channel', resolvedId: target.id });
          const events = auditMemoryManager.getChannelEvents(message.guildId, target.id, 10);
          if (!events.length) return message.reply('Nenhum evento encontrado para este canal.');
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Alvo: <#${e.targetId}>)`).join('\n');
          return message.reply(`**Últimos eventos do canal ${target.name} (<#${target.id}>):**\n${text}`);
        }

        if (subcmd === 'bot' && rawTargetInput) {
          const target = await resolveTarget(message.guild, rawTargetInput, 'bot');
          if (!target) return message.reply('Bot não encontrado.');
          logger.info('[AUDIT TARGET RESOLVED]', { input: rawTargetInput, resolvedType: 'bot', resolvedId: target.id });
          const events = auditMemoryManager.getBotEvents(message.guildId, target.id, 10);
          if (!events.length) return message.reply('Nenhum evento encontrado para este bot.');
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Bot Alvo: <@${e.targetBotId}>)`).join('\n');
          return message.reply(`**Últimos eventos do bot ${target.name}:**\n${text}`);
        }
        
        if (subcmd === 'bots') {
          const events = auditMemoryManager.getBotEvents(message.guildId, null, 10);
          logger.info('[AUDIT BOT COUNT]', { totalBotEvents: events.length });
          if (!events.length) return message.reply('Nenhum evento de adição de bot encontrado.');
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Bot Alvo: <@${e.targetBotId}>)`).join('\n');
          return message.reply(`**Últimos bots adicionados:**\n${text}`);
        }

        if (subcmd === 'today' || subcmd === '24h' || subcmd === 'yesterday' || subcmd === '7d' || subcmd === '30d') {
          let hours = 24;
          if (subcmd === 'yesterday') hours = 48; // Aproximação
          if (subcmd === '7d') hours = 24 * 7;
          if (subcmd === '30d') hours = 24 * 30;

          const events = auditMemoryManager.getEventsByTimeframe(message.guildId, hours).slice(0, 15);
          if (!events.length) return message.reply(`Nenhum evento encontrado para o período ${subcmd}.`);
          const text = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Alvo: ${e.targetId || e.targetBotId || 'N/A'})`).join('\n');
          return message.reply(`**Eventos em ${subcmd} (últimos 15):**\n${text}`);
        }
        
        if (subcmd === 'bans' || subcmd === 'roleadd' || subcmd === 'roleremove' || subcmd === 'channels') {
          const actionMap = {
            'bans': ['MEMBER_BAN_ADD', 'MEMBER_BAN_REMOVE'],
            'roleadd': ['ROLE_UPDATE', 'MEMBER_UPDATE'],
            'roleremove': ['ROLE_UPDATE', 'MEMBER_UPDATE'],
            'channels': ['CHANNEL_CREATE', 'CHANNEL_DELETE', 'CHANNEL_UPDATE']
          };
          
          const actionsToFilter = actionMap[subcmd];
          const allEvents = auditMemoryManager.getAllEvents(message.guildId);
          const filtered = allEvents.filter(e => actionsToFilter.includes(e.action)).slice(0, 10);
          
          if (!filtered.length) {
            await message.reply(`Nenhum evento do tipo ${subcmd} encontrado.`).catch(() => {});
            return;
          }
          
          const text = filtered.map(e => `[${new Date(e.timestamp).toLocaleString()}] **${e.action}** por <@${e.executorId}> (Alvo: ${e.targetId})`).join('\n');
          await message.reply(`**Últimos eventos (${subcmd}):**\n${text}`).catch(() => {});
          return;
        }
        
        if (subcmd === 'export') {
          let allEvents = auditMemoryManager.getAllEvents(message.guildId);
          if (!allEvents.length) {
            await message.reply('Não há dados de auditoria para exportar.').catch(() => {});
            return;
          }
          
          const filterType = cmdParts[2]?.toLowerCase();
          const rawTargetFilter = cmdParts.slice(3).join(' ');
          
          if (filterType === 'user' && rawTargetFilter) {
            const target = await resolveTarget(message.guild, rawTargetFilter, 'user');
            if (target) allEvents = auditMemoryManager.getUserEvents(message.guildId, target.id, 5000);
          } else if (filterType === 'role' && rawTargetFilter) {
            const target = await resolveTarget(message.guild, rawTargetFilter, 'role');
            if (target) allEvents = auditMemoryManager.getRoleEvents(message.guildId, target.id, 5000);
          } else if (filterType === '7d') {
            allEvents = auditMemoryManager.getEventsByTimeframe(message.guildId, 24 * 7);
          } else if (filterType === 'bots') {
            allEvents = auditMemoryManager.getBotEvents(message.guildId, null, 5000);
          }
          
          const exportPath = path.join(__dirname, '..', '..', 'data', `audit-export-${message.guildId}-${Date.now()}.json`);
          fs.writeFileSync(exportPath, JSON.stringify(allEvents, null, 2));
          
          await message.reply({
            content: `✅ Exportação de auditoria concluída (${allEvents.length} registros).`,
            files: [exportPath]
          }).catch(() => {});
          
          // Limpar arquivo após enviar
          setTimeout(() => {
            if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath);
          }, 10000);
          return;
        }

        await message.reply('Comando de auditoria inválido. Use: `rp audit recent`, `rp audit user/role/channel/bot <alvo>`, `rp audit bots`, `rp audit bans`, `rp audit today/24h/7d/30d`, `rp audit export`.').catch(() => {});
        return;
      }

      // rp help — mostra catálogo de comandos
      if (cmd === 'help') {
        const helpEmbed = generateHelpEmbed();
        await message.reply({ embeds: [helpEmbed] }).catch(() => {});
        return;
      }

      // debug memory — mostra contexto do servidor
      if (cmd === 'debug' && cmdParts[1] === 'memory') {
        await message.reply(
          `**SERVER CONTEXT — PRÚSSIA (Minecraft Clan)**\n\n` +
          `• Fundação: 20/01/2026\n` +
          `• Origem: Reino de Sauria + Sacro Império Prusso\n` +
          `• Armekaiser: General 013\n` +
          `• Stazkaiser: Kruskov\n\n` +
          `**Korps ativos:** Ravens, Viltrumit, Drittes, Totenkopf, Fünften, Ersten Kreuse, Bizarre, Neo Marchium\n\n` +
          `**Personalidades:**\n` +
          `• akira_feminine_tsundere (2 usuários)\n` +
          `• servant (1 usuário)\n` +
          `• tester, admintester (configuráveis)\n` +
          `• prussia_lore (prefixo mp/mprussia)\n` +
          `• technical_assistant (auto-detectado)\n` +
          `• default (usuários comuns)`
        ).catch(() => {});
        return;
      }

      // debug audit — estatísticas da auditoria
      if (cmd === 'debug' && cmdParts[1] === 'audit') {
        if (!isAdminUser) {
          await message.reply('❌ Você não tem permissão para acessar o debug da auditoria.').catch(() => {});
          return;
        }
        const allEvents = auditMemoryManager.getAllEvents(message.guildId);
        
        let actionsCount = {};
        allEvents.forEach(e => {
          actionsCount[e.action] = (actionsCount[e.action] || 0) + 1;
        });
        
        const lastSync = allEvents.length ? new Date(allEvents[0].timestamp).toLocaleString() : 'N/A';
        
        let statsStr = `**Estatísticas de Auditoria (${message.guildId}):**\n\n`;
        statsStr += `• Total de eventos armazenados: ${allEvents.length}/5000\n`;
        statsStr += `• Último evento registrado: ${lastSync}\n\n`;
        statsStr += `**Distribuição de ações:**\n`;
        
        for (const [action, count] of Object.entries(actionsCount)) {
          statsStr += `• ${action}: ${count}\n`;
        }
        
        await message.reply(statsStr).catch(() => {});
        return;
      }

      // debug providers - mostra o status de todos os provedores de IA
      if (cmd === 'debug' && cmdParts[1] === 'providers') {
        const statuses = aiProvider.getProviderStatuses();
        let reply = `**Provider | Status**\n\n`;
        statuses.forEach(p => {
          reply += `**${p.name}** | ${p.status}\n`;
        });
        
        let currentProvider = config.AI.provider || 'multi-provider';
        if (currentProvider === 'multi-provider') {
            const available = multiProvider.getAvailableProviders();
            if (available.length > 0) {
              currentProvider = available[0];
            } else {
              currentProvider = 'Nenhum';
            }
        }
        reply += `\n**Provider atual:** ${currentProvider}`;
        
        await message.reply(reply).catch(() => {});
        return;
      }

      // Verifica cooldown
      if (contextManager.isOnCooldown(message.author.id)) {
        const remaining = contextManager.getCooldownTimeRemaining(message.author.id);
        logger.debug('⏳ Usuário em cooldown', {
          user: message.author.tag,
          remainingMs: remaining
        });
        return;
      }

      // Mostra que está digitando (opcional - não bloqueia o fluxo)
      logger.debug('[DEBUG] [DISCORD API] Antes de message.channel.sendTyping()');
      const typingStart = Date.now();
      try {
        await message.channel.sendTyping();
        logger.debug('[DEBUG] [DISCORD API] Depois de message.channel.sendTyping() - OK', { tempoMs: Date.now() - typingStart });
      } catch (error) {
        // sendTyping() falhou, mas isso NÃO deve interromper o fluxo
        // O bot continua funcionando normalmente
        logger.warn('[DISCORD API] Falha em message.channel.sendTyping() - continuando normalmente', {
          metodo: 'message.channel.sendTyping()',
          arquivo: 'src/events/messageCreate.js',
          error: error.message,
          codigo: error.code,
          causa: error.cause ? {
            code: error.cause.code,
            message: error.cause.message,
            address: error.cause.address,
            port: error.cause.port
          } : null,
          tempoMs: Date.now() - typingStart,
          stack: error.stack
        });
        // NÃO lançar o erro - continuar execução
      }

      // Remove o prefixo

      logger.info('💬 Mensagem de IA recebida', {
        user: message.author.tag,
        channel: message.channel.name,
        messageLength: userMessage.length,
        mentioned: isMentioned
      });

      // IA normal
      if (!config.FEATURES.AI_ENABLED) {
        logger.debug('[DEBUG] IA desativada nas configurações');
        return;
      }

      // Verificação de limite diário para Testers
      if (role === 'tester' && !isAdminUser) {
        if (!testerUsageManager.canUse(message.author.id)) {
          await message.reply(
            `❌ Você atingiu o limite diário de testes.\n\n` +
            `Limite:\n` +
            `10 usos por dia\n\n` +
            `Volte amanhã para continuar utilizando o sistema.`
          ).catch(() => {});
          return;
        }
      }

      logger.info('[DEBUG PROVIDER]', {
        provider: config.AI.provider || 'multi-provider',
        exportsDisponiveis: Object.keys(aiProvider).filter(key => typeof aiProvider[key] === 'function'),
        hasBuildSystemPrompt: typeof aiProvider.buildSystemPrompt === 'function',
        hasGenerateResponse: typeof aiProvider.generateResponse === 'function',
        arquivo: 'src/events/messageCreate.js'
      });

      try {
        // PASSO 3 - Carregamento de memória
        logger.debug('[DEBUG] PASSO 3 - Carregando memória e contexto...');
        const step3Start = Date.now();
        const step3Timeout = createDiagnosticTimeout('carregamento de memória', step3Start);
        
        const context = await contextManager.getPromptContext(
          message.author.id,
          message.guildId,
          message.channelId
        );
        // Injeta userId no contexto para personalidades por usuário (ex: tsundere)
        context.userId = message.author.id;
        context.role = role;

        const prussiaPrefixMatch = content.match(/^(mp|mprussia)[,\s]*/i);
        context.isPrussiaMode = !!prussiaPrefixMatch;
        
        clearTimeout(step3Timeout);
        const step3Time = Date.now() - step3Start;
        
        logger.debug('[DEBUG] PASSO 3 CONCLUÍDO - Memória carregada', {
          tempoMs: step3Time,
          hasUserMemory: !!context.userMemory,
          hasChannelMemory: !!context.channelMemory,
          hasServerMemory: !!context.serverMemory,
          historyLength: Array.isArray(context.history) ? context.history.length : 0
        });

        // PASSO 4 - Montagem de contexto
        logger.debug('[DEBUG] PASSO 4 - Montando contexto para geração de resposta...');
        const step4Start = Date.now();
        
        // A montagem real do prompt agora fica dentro do provider selecionado
        // (src/ai/provider.js -> openrouter.js ou ollama.js), que decide entre
        // modo conversation e modo action. Mantemos aqui apenas uma estimativa
        // de tamanho para diagnóstico, sem chamar buildSystemPrompt diretamente.
        const promptText = [
          context.userMemory ? `Memória do usuário: ${context.userMemory}` : '',
          context.channelMemory ? `Memória do canal: ${context.channelMemory}` : '',
          context.serverMemory ? `Resumo do servidor: ${context.serverMemory}` : '',
          Array.isArray(context.history) && context.history.length
            ? `Histórico recente: ${context.history.length} mensagens`
            : '',
          `Usuário: ${userMessage}`
        ].filter(Boolean).join('\n\n');
        
        const step4Time = Date.now() - step4Start;
        logger.debug('[DEBUG] PASSO 4 CONCLUÍDO - Contexto montado', {
          tempoMs: step4Time,
          promptLength: promptText.length
        });

        // PASSO 5 - Chamada da IA
        logger.debug('[DEBUG] PASSO 5 - Chamando IA para gerar resposta...');
        const step5Start = Date.now();
        const step5Timeout = createDiagnosticTimeout('chamada da IA', step5Start);
        
        logger.info('[AI GENERATION START]', {
          requestId,
          provider: config.AI.provider || 'multi-provider',
          userId: context.userId,
          arquivo: 'src/events/messageCreate.js'
        });

        // ══════════════════════════════════════════════════════════════════
        // DIRECT AUDIT NATURAL QUERY BYPASS
        // ══════════════════════════════════════════════════════════════════
        logger.info('[AUDIT BYPASS START]');
        
        let auditBypassHandled = false;

        // Função interna para lidar com todas as consultas naturais de auditoria
        async function handleAuditNaturalQuery() {
          const isBotQuery = /(?:quem|algu[ée]m|qual)\s+(adicionou|convidou|colocou|trouxe)\s+(?:o\s+)?(?:bot\s+)?(.+?)\??$/i.test(lowerMessage) || 
                             /(?:quem|algu[ée]m|qual)\s+(adicionou|convidou|colocou|trouxe)\s+(?:o\s+)?bot\??$/i.test(lowerMessage) ||
                             /(?:quem|algu[ée]m|qual)\s+(adicionou|convidou|colocou|trouxe)\s+esse\s+bot\??$/i.test(lowerMessage);

          const isGeneralQuery = /(?:quem|algu[ée]m|qual)\s+(baniu|desbaniu|deu|removeu|criou|apagou|mudou|alterou|tirou|colocou|kickou|expulsou|mutou|mandou|configurou)(?:\s+(?:o\s+|a\s+|cargo\s+)?(.+?))?\??$/i.test(lowerMessage) || 
                                 /quais\s+(canais|bots|cargos)\b.*?/i.test(lowerMessage);

          if (!isBotQuery && !isGeneralQuery) {
            return false;
          }

          logger.info('[AUDIT NATURAL QUERY]', { target: userMessage.substring(0, 50) });

          // Tratamento específico para Bots (com fallback na API)
          if (isBotQuery) {
            const botQueryMatch = lowerMessage.match(/(?:quem|algu[ée]m|qual)\s+(adicionou|convidou|colocou|trouxe)\s+(?:o\s+)?(?:bot\s+)?(.+?)\??$/i);
            let botName = botQueryMatch ? botQueryMatch[2] : 'recente';
            let botEvents = [];
            let resolvedTarget = null;
            
            if (botName !== 'recente' && botName !== 'esse bot' && botName !== 'bot') {
              resolvedTarget = await resolveTarget(message.guild, botName, 'bot');
              if (resolvedTarget) {
                botEvents = auditMemoryManager.getBotEvents(message.guildId, resolvedTarget.id, 1);
                botName = resolvedTarget.name;
              } else {
                const allBotEvents = auditMemoryManager.getBotEvents(message.guildId, null, 100);
                botEvents = allBotEvents.filter(e => e.targetBotName && e.targetBotName.toLowerCase().includes(botName.toLowerCase())).slice(0, 1);
              }
            } else {
              botEvents = auditMemoryManager.getBotEvents(message.guildId, null, 1);
            }

            logger.info('[AUDIT BOT SEARCH]', { target: botName, targetType: 'bot', source: 'natural_query' });

            if (botEvents.length > 0) {
              const e = botEvents[0];
              const time = new Date(e.timestamp).toLocaleString();
              await sendDiscordMessage(message, `O bot **${e.targetBotName || botName}** foi adicionado por <@${e.executorId}> em ${time}.`, 'direct audit result', requestId);
              logger.info('[AUDIT BYPASS RESULT]', { found: true, source: 'memory' });
              return true;
            }

            try {
              const logs = await message.guild.fetchAuditLogs({ type: 28, limit: 20 });
              const entries = Array.from(logs.entries.values());
              let foundEntry = null;

              if (botName !== 'recente' && botName !== 'esse bot' && botName !== 'bot') {
                if (resolvedTarget) {
                  foundEntry = entries.find(e => e.targetId === resolvedTarget.id);
                } else {
                  foundEntry = entries.find(e => e.target && e.target.username && e.target.username.toLowerCase().includes(botName.toLowerCase()));
                }
              } else {
                foundEntry = entries[0];
              }

              if (foundEntry) {
                const time = foundEntry.createdAt.toLocaleString();
                await sendDiscordMessage(message, `O bot **${foundEntry.target?.username || botName}** foi adicionado por <@${foundEntry.executorId}> em ${time}.`, 'direct audit result', requestId);
                logger.info('[AUDIT BYPASS RESULT]', { found: true, source: 'discord_api' });
                return true;
              }
            } catch (err) {
              logger.error('[AUDIT BOT LOOKUP ERROR]', { error: err.message, target: botName });
            }

            await sendDiscordMessage(message, 'Não encontrei registros desse bot na memória de auditoria.', 'direct audit fallback', requestId);
            logger.info('[AUDIT BYPASS RESULT]', { found: false, source: 'none' });
            return true;
          }

          // Tratamento geral para ban, kick, roles, etc.
          if (isGeneralQuery) {
            const generalMatch = lowerMessage.match(/(?:quem|algu[ée]m|qual)\s+(baniu|desbaniu|deu|removeu|criou|apagou|mudou|alterou|tirou|colocou|kickou|expulsou|mutou|mandou|configurou)(?:\s+(?:o\s+|a\s+|cargo\s+)?(.+?))?\??$/i);
            const actionVerb = generalMatch ? generalMatch[1].toLowerCase() : '';
            const rawTarget = generalMatch && generalMatch[2] ? generalMatch[2] : null;

            let recentEvents = [];
            
            if (rawTarget) {
               // Tenta resolver para filtrar apenas pro usuário/cargo pedido
               const uTarget = await resolveTarget(message.guild, rawTarget, 'user');
               const rTarget = await resolveTarget(message.guild, rawTarget, 'role');
               const cTarget = await resolveTarget(message.guild, rawTarget, 'channel');
               
               let resolvedId = null;
               if (uTarget) resolvedId = uTarget.id;
               else if (rTarget) resolvedId = rTarget.id;
               else if (cTarget) resolvedId = cTarget.id;

               if (resolvedId) {
                  const allEvs = auditMemoryManager.getAllEvents(message.guildId);
                  recentEvents = allEvs.filter(e => e.targetId === resolvedId || e.roleId === resolvedId || e.channelId === resolvedId).slice(0, 5);
               } else {
                  // Fallback para os mais recentes gerais se não resolver
                  recentEvents = auditMemoryManager.getRecentEvents(message.guildId, 10);
               }
            } else {
               recentEvents = auditMemoryManager.getRecentEvents(message.guildId, 10);
            }

            if (recentEvents.length > 0) {
              const auditText = recentEvents.map(e => {
                const executor = e.requestedBy ? `<@${e.requestedBy}> (via bot)` : `<@${e.executorId}>`;
                return `[${new Date(e.timestamp).toLocaleString()}] Ação: ${e.action} | Executor: ${executor} | Alvo: <@${e.targetId || e.targetBotId || e.roleId || e.channelId || 'N/A'}>`;
              }).join('\n');
              
              await sendDiscordMessage(message, `**Registros encontrados na Auditoria:**\n${auditText}`, 'direct audit result', requestId);
              logger.info('[AUDIT BYPASS RESULT]', { found: true, source: 'memory' });
              return true;
            }

            await sendDiscordMessage(message, 'Não encontrei esse evento no histórico de auditoria.', 'direct audit fallback', requestId);
            logger.info('[AUDIT BYPASS RESULT]', { found: false, source: 'none' });
            return true;
          }

          return false;
        }

        try {
          auditBypassHandled = await handleAuditNaturalQuery();
        } catch (err) {
          logger.error('[AUDIT BYPASS FAILED]', { reason: err.message });
        }

        if (auditBypassHandled) {
          logger.info('[AUDIT BYPASS COMPLETE]', { requestId, source: 'audit_natural' });
          return; // ENCERRA O FLUXO COMPLETAMENTE
        }

        // Injeta rawMessage no context para detecção de prefixos como MPrussia
        context.rawMessage = content;

      // ══════════════════════════════════════════════════════════════════════
      // ACTION MODE UNIVERSAL CLASSIFIER
      // ══════════════════════════════════════════════════════════════════════
      const isActionRequest = UNIVERSAL_ACTION_VERBS_REGEX.test(lowerMessage);

      logger.info('[ACTION CLASSIFIER]', {
        requestId,
        isActionRequest,
        message: lowerMessage.substring(0, 100),
        arquivo: 'src/events/messageCreate.js'
      });

      if (isActionRequest) {
        logger.info('[ACTION CAPABILITY FOUND]', {
          requestId,
          reason: 'Universal action verb detected.',
          arquivo: 'src/events/messageCreate.js'
        });
        context.isActionMode = true;
        // Inject the tool catalog directly into the context for the provider to use.
        context.toolCatalog = getActionsForPrompt();
      }

        // Log de personalidade selecionada
        logger.info('[PERSONALITY SELECTED]', {
          requestId,
          userId: context.userId,
          role: context.role,
          isPrussiaMode: context.isPrussiaMode || false,
          isActionMode: context.isActionMode || false,
          arquivo: 'src/events/messageCreate.js'
        });

        const response = await aiProvider.generateResponse(userMessage, context);
        
        clearTimeout(step5Timeout);
        const step5Time = Date.now() - step5Start;

        logger.info('[AI GENERATION END]', {
          requestId,
          responseLength: response.length,
          responseTimeMs: step5Time,
          arquivo: 'src/events/messageCreate.js'
        });
        
        logger.debug('[DEBUG] PASSO 5 CONCLUÍDO - Resposta recebida da IA', {
          tempoMs: step5Time,
          responseLength: response.length
        });

        logger.info('✅ Resposta de IA gerada', {
          user: message.author.tag,
          responseTime: `${step5Time}ms`,
          responseLength: response.length
        });

        // PASSO 6 - Processamento da resposta
        logger.debug('[DEBUG] PASSO 6 - Processando resposta...');
        const step6Start = Date.now();
        
        const parsedAction = tryParseStructuredResponse(response.text || response);
        
        // Handle fallback from Action Mode to conversational mode
        if (parsedAction && parsedAction.action === 'fallback_to_chat') {
          logger.info('[ACTION FALLBACK TO CHAT]', {
            requestId,
            reason: parsedAction.params?.reason || 'Model determined no suitable tool.',
            arquivo: 'src/events/messageCreate.js'
          });

          // Re-run generation in conversational mode
          context.isActionMode = false;
          delete context.toolCatalog; // Clean up context
          const conversationalResponse = await aiProvider.generateResponse(userMessage, context);

          // Send the new conversational response and save context, then exit.
          await contextManager.addMessage(message.author.id, guildId, 'user', userMessage, message.channelId, message.channel.name, message.author.tag);
          await contextManager.addMessage(message.author.id, guildId, 'assistant', conversationalResponse, message.channelId, message.channel.name, config.BOT_NAME);
          await sendDiscordMessage(message, conversationalResponse.text || conversationalResponse, 'resposta de fallback', requestId);

          if (role === 'tester' && !isAdminUser) {
            testerUsageManager.addUsage(message.author.id, 1);
          }
          return;
        }

        if (context.isActionMode) {
          let expected = 'unknown';
          const lowerMsg = userMessage.toLowerCase();
          if (/apag|limp|delet/i.test(lowerMsg)) expected = 'purge_messages';
          else if (/ban/i.test(lowerMsg)) expected = 'ban_user';
          else if (/kick|expuls/i.test(lowerMsg)) expected = 'kick_user';
          else if (/mut|timeout/i.test(lowerMsg)) expected = 'timeout_user';
          
          const received = parsedAction?.action || 'none';
          
          if (expected !== 'unknown' && received !== expected) {
            logger.warn('[ACTION MODE ACTION CHOICE]', {
              input: userMessage,
              expectedAction: expected,
              receivedAction: received,
              responseObj: parsedAction,
              reason: 'Model hallucinated permission error or wrong action'
            });
          } else {
            logger.info('[ACTION MODE ACTION CHOICE]', {
              input: userMessage,
              expectedAction: expected,
              receivedAction: received
            });
          }
        }
        
        const step6Time = Date.now() - step6Start;
        
        if (parsedAction && parsedAction.action) {
          logger.debug('[DEBUG] Ação detectada na resposta', {
            action: parsedAction.action,
            params: parsedAction.params
          });
          logger.info('[ACTION JSON GENERATED]', {
            requestId,
            arquivo: 'src/events/messageCreate.js',
            action: parsedAction.action,
            params: parsedAction.params
          });
          
          // PASSO 7 - Execução de ação
          logger.debug('[DEBUG] PASSO 7 - Executando ação...');
          const step7Start = Date.now();
          
          // ══════════════════════════════════════════════════════════════════
          // NOVO PIPELINE DE EXECUÇÃO DE ACTION (V3)
          // ══════════════════════════════════════════════════════════════════
          let actionResult = { success: false, error: 'Ação não pôde ser processada.' };
          try {
            // 1. RESOLVER: Encontra a definição da action no registry
            const actionDefinition = resolveAction(parsedAction.action);
            if (!actionDefinition) {
              throw new Error(`Ação '${parsedAction.action}' não encontrada no registro.`);
            }
            logger.info('[ACTION RESOLVER]', { action: actionDefinition.name });

            // 2. VALIDAR: Verifica permissões e condições
            const validation = validateAction(actionDefinition, message);
            if (!validation.isValid) {
              throw new Error(validation.reason);
            }
            logger.info('[ACTION VALIDATOR]', { action: actionDefinition.name, result: 'Válido' });

            // 3. EXECUTAR: Chama a função correspondente no executor
            const executorFunction = actionExecutor[actionDefinition.executorName];
            if (typeof executorFunction !== 'function') {
              throw new Error(`Executor '${actionDefinition.executorName}' não encontrado ou não é uma função.`);
            }
            logger.info('[ACTION EXECUTOR]', { executor: actionDefinition.executorName });

            const executionResponse = await executorFunction(parsedAction.params, message);
            actionResult = { success: true, summary: executionResponse };
            logger.info('[ACTION SUCCESS]', { action: actionDefinition.name, response: executionResponse });

          } catch (error) {
            logger.error('[ACTION FAILED]', {
              action: parsedAction.action,
              error: error.message,
              stack: error.stack.substring(0, 300)
            });
            actionResult = { success: false, error: error.message };
          }
          
          const step7Time = Date.now() - step7Start;
          logger.debug('[DEBUG] PASSO 7 CONCLUÍDO - Ação executada', {
            tempoMs: step7Time,
            success: actionResult.success
          });

          // Salva contexto e responde ao usuário
          const contextMessage = actionResult.success
            ? `Ação ${parsedAction.action} executada com sucesso.`
            : `Falha ao executar ${parsedAction.action}: ${actionResult.error}`;

          await contextManager.addMessage(message.author.id, message.guildId, 'user', userMessage, message.channelId, message.channel.name, message.author.tag);
          await contextManager.addMessage(message.author.id, message.guildId, 'assistant', contextMessage, message.channelId, message.channel.name, config.BOT_NAME);

          if (actionResult.success) {
            await sendDiscordMessage(message, {
              content: `✅ ${actionResult.summary}`,
              allowedMentions: { repliedUser: false }
            }, 'ação bem-sucedida', requestId);
          } else {
            const errorContent = `❌ ${actionResult.error}`;
            await sendDiscordMessage(message, errorContent, 'erro de ação', requestId);
          }

          if (role === 'tester' && !isAdminUser) {
            testerUsageManager.addUsage(message.author.id, 1);
          }
          return;
        }

        // PASSO 8 - Salvando no contexto
        logger.debug('[DEBUG] PASSO 8 - Salvando no contexto...');
        const step8Start = Date.now();
        
        logger.debug('[DEBUG] [DISCORD API] Antes de contextManager.addMessage() - PASSO 8 usuário');
        const addMsgStart4 = Date.now();
        try {
          await contextManager.addMessage(
            message.author.id,
            message.guildId,
            'user',
            userMessage,
            message.channelId,
            message.channel.name,
            message.author.tag
          );
          logger.debug('[DEBUG] [DISCORD API] Depois de contextManager.addMessage() - PASSO 8 usuário OK', { tempoMs: Date.now() - addMsgStart4 });
        } catch (error) {
          logger.error('[DEBUG] [DISCORD API] ERRO em addMessage() - PASSO 8 usuário', {
            error: error.message,
            tempoMs: Date.now() - addMsgStart4,
            stack: error.stack
          });
          throw error;
        }

        logger.debug('[DEBUG] [DISCORD API] Antes de contextManager.addMessage() - PASSO 8 assistente');
        const addMsgStart5 = Date.now();
        try {
          await contextManager.addMessage(
            message.author.id,
            message.guildId,
            'assistant',
            response.text || response,
            message.channelId,
            message.channel.name,
            config.BOT_NAME
          );
          logger.debug('[DEBUG] [DISCORD API] Depois de contextManager.addMessage() - PASSO 8 assistente OK', { tempoMs: Date.now() - addMsgStart5 });
        } catch (error) {
          logger.error('[DEBUG] [DISCORD API] ERRO em addMessage() - PASSO 8 assistente', {
            error: error.message,
            tempoMs: Date.now() - addMsgStart5,
            stack: error.stack
          });
          throw error;
        }
        
        const step8Time = Date.now() - step8Start;
        logger.debug('[DEBUG] PASSO 8 CONCLUÍDO - Contexto salvo', { tempoMs: step8Time });

        // PASSO 9 - Enviando resposta para Discord
        logger.debug('[DEBUG] PASSO 9 - Enviando resposta para Discord...');
        const step9Start = Date.now();
        
        const responseText = response.text || response;
        if (responseText.length > 2000) {
          const chunks = responseText.match(/[\s\S]{1,1990}/g) || [];
          logger.debug('[DEBUG] Resposta longa, enviando em', chunks.length, 'chunks');
          for (let i = 0; i < chunks.length; i++) {
            // [TESTE DE ISOLAMENTO] Usando sendDiscordMessage() para teste reply vs channel.send
            await sendDiscordMessage(message, chunks[i], `chunk ${i + 1}/${chunks.length}`, requestId);
          }
        } else {
          // [TESTE DE ISOLAMENTO] Usando sendDiscordMessage() para teste reply vs channel.send
          await sendDiscordMessage(message, responseText, 'resposta única', requestId);
        }
        
        const step9Time = Date.now() - step9Start;
        logger.debug('[DEBUG] PASSO 9 CONCLUÍDO - Resposta enviada', { tempoMs: step9Time });

        if (role === 'tester' && !isAdminUser) {
          testerUsageManager.addUsage(message.author.id, 1);
        }

        const totalTime = Date.now() - flowStartTime;
        logger.debug('[DEBUG] FLUXO CONCLUÍDO - Tempo total:', {
          totalMs: totalTime,
          totalSeconds: (totalTime / 1000).toFixed(2)
        });
        
      } catch (error) {
        logger.error('❌ Erro ao gerar resposta de IA', { error: error.message });
        logger.error('[DEBUG] Stack trace completo do erro:', { stack: error.stack });

        let errorMsg = '❌ Desculpe, tive um problema ao processar sua mensagem.';

        if (error.isGlobalAiFailure) {
          if (isAdminUser) {
            errorMsg = '❌ Nenhum provedor disponível.\n';
            if (error.providerStatuses && Array.isArray(error.providerStatuses)) {
              error.providerStatuses.forEach(p => {
                errorMsg += `${p.name}: ${p.status.toLowerCase()}\n`;
              });
            }
            errorMsg += 'Use `rp debug providers` para mais detalhes.';
          } else {
            errorMsg = '❌ Todos os provedores de IA estão indisponíveis no momento.';
          }
        } else if (error.message.includes('limite')) {
          errorMsg = '❌ Limite de requisições excedido. Tente novamente em alguns momentos.';
        } else if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
          errorMsg = '❌ Conexão com IA expirou. Tente novamente.';
        }

        // [TESTE DE ISOLAMENTO] Usando sendDiscordMessage() para teste reply vs channel.send
        await sendDiscordMessage(message, errorMsg, 'erro de IA', requestId);
      }
    } catch (error) {
      logger.error('❌ Erro não tratado em messageCreate', { error: error.message });
      logger.error('[DEBUG] Stack trace completo do erro não tratado:', { stack: error.stack });
    }
  }
};
