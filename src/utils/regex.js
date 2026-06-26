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
 * @returns {boolean} - Se deve ativar a IA
 */
function shouldActivateAI(content, isMentioned) {
  const trimmed = (content || '').trim();

  // 1) Menção sempre ativa
  if (isMentioned) {
    logger.info('[TRIGGER]', {
      message: trimmed.substring(0, 80),
      mentioned: true,
      prefixMatched: false,
      triggerAccepted: true,
      motivo: 'bot mencionado'
    });
    return true;
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

module.exports = {
  shouldActivateAI,
  stripPrefix,
  escapeRegex
};
