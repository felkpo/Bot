const config = require('../config/config');
const logger = require('./logger');

/**
 * Detecta se uma mensagem deve ativar a IA
 * Arquivo: src/utils/regex.js
 * Prefixos aceitos: config.AI.prefixes (inclui RP, rp, Rp, rP via flag 'i')
 * Regex utilizada por prefixo: ^<prefix>(?:[,\s]|$)   (case-insensitive)
 *
 * @param {string} content - Conteúdo da mensagem
 * @param {boolean} isMentioned - Se o bot foi mencionado
 * @param {import('discord.js').Message} [message] - O objeto da mensagem, para verificações adicionais
 * @returns {boolean} - Se deve ativar a IA
 */
function shouldActivateAI(content, isMentioned, message) {
  const trimmed = (content || '').trim();

  // 1) Verificação de Menção
  if (isMentioned) {
    // A menção só ativa a IA se NÃO houver @everyone ou @here.
    // Se houver, a ativação dependerá exclusivamente do prefixo.
    if (message && (message.mentions.everyone || message.mentions.here)) {
      logger.info('[TRIGGER]', {
        message: trimmed.substring(0, 80),
        mentioned: true,
        hasMassMention: true,
        prefixMatched: false,
        triggerAccepted: false, // Será reavaliado pela verificação de prefixo
        motivo: 'bot mencionado, mas com @everyone/@here; verificando prefixos'
      });
      // Não retorna true, deixa a verificação de prefixo decidir.
    } else {
      // Menção "limpa" (sem @everyone/@here) sempre ativa.
      logger.info('[TRIGGER]', {
        message: trimmed.substring(0, 80),
        mentioned: true,
        prefixMatched: false,
        triggerAccepted: true,
        motivo: 'bot foi mencionado diretamente ou em resposta'
      });
      return true;
    }
  }

  // 2) Verifica cada prefixo
  let prefixMatched = false;
  let matchedPrefix = null;
  let usedRegex = null;

  for (const prefix of config.AI.prefixes) {
    // Padrão: "prefix" seguido de vírgula, espaço OU fim de string.
    // Aceita "RP oi", "RP, oi", "RP" (sozinho) e qualquer caixa (flag 'i').
    const pattern = new RegExp(`^${escapeRegex(prefix)}(?:[,\\s]|$)`, 'i');
    if (pattern.test(trimmed)) {
      prefixMatched = true;
      matchedPrefix = prefix;
      usedRegex = pattern.toString();
      break;
    }
  }

  if (prefixMatched) {
    logger.info('[TRIGGER]', {
      message: trimmed.substring(0, 80),
      mentioned: false,
      prefixMatched: true,
      triggerAccepted: true,
      matchedPrefix: matchedPrefix,
      regex: usedRegex,
      arquivo: 'src/utils/regex.js'
    });
    return true;
  }

  logger.info('[TRIGGER]', {
    message: trimmed.substring(0, 80),
    mentioned: false,
    prefixMatched: false,
    triggerAccepted: false,
    motivo: 'nenhum prefixo correspondeu e o bot não foi mencionado',
    prefixosAceitos: config.AI.prefixes,
    arquivo: 'src/utils/regex.js'
  });
  return false;
}

/**
 * Remove o prefixo da mensagem
 * @param {string} content - Conteúdo da mensagem
 * @returns {string} - Conteúdo sem prefixo
 */
function stripPrefix(content) {
  const trimmed = content.trim();
  
  for (const prefix of config.AI.prefixes) {
    const pattern = new RegExp(`^${escapeRegex(prefix)}[,\\s]*`, 'i');
    const match = trimmed.match(pattern);
    if (match) {
      return trimmed.substring(match[0].length).trim();
    }
  }
  
  // Se foi mencionado, remove a menção do início
  return trimmed.replace(/^<@!?\d+>\s*/, '').trim();
}

/**
 * Escapa caracteres especiais de regex
 * @param {string} str - String a escapar
 * @returns {string} - String escapada
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Regex universal para detectar verbos de ação no início de uma mensagem.
 * Usado para classificar se uma mensagem é um pedido de execução de ação (tool use).
 * Arquivo: src/utils/regex.js
 */
const UNIVERSAL_ACTION_VERBS_REGEX = /^(banir|expulsar|kickar|chutar|mutar|silenciar|punir|limpar|apagar|deletar|adicionar|remover|setar|definir|modificar|listar|criar|ver|mostrar|auditar|consultar|ajuda|enviar|falar|tocar|mover|avisar)\b/i;

module.exports = {
  shouldActivateAI,
  stripPrefix,
  escapeRegex,
  UNIVERSAL_ACTION_VERBS_REGEX
};
