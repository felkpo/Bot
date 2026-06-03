const config = require('../config/config');

/**
 * Detecta se uma mensagem deve ativar a IA
 * @param {string} content - Conteúdo da mensagem
 * @param {boolean} isMentioned - Se o bot foi mencionado
 * @returns {boolean} - Se deve ativar a IA
 */
function shouldActivateAI(content, isMentioned) {
  if (isMentioned) return true;
  
  const trimmed = content.trim();
  
  // Verifica cada prefixo
  for (const prefix of config.AI.prefixes) {
    // Padrão: "prefix" ou "prefix," seguido de espaço ou fim de string
    const pattern = new RegExp(`^${escapeRegex(prefix)}[,\\s]`, 'i');
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
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
