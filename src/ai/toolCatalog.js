/**
 * @deprecated Este arquivo foi substituído por `src/ai/actionRegistry.js`.
 * Ele é mantido temporariamente para compatibilidade, mas será removido em breve.
 * Não adicione novas ferramentas aqui. Use o Action Registry.
 * 
 * @file src/ai/toolCatalog.js (DEPRECATED)
 */

const logger = require('../utils/logger');
const { getActionsForPrompt, getAllActions } = require('./actionRegistry');

logger.warn('[DEPRECATION] O módulo `src/ai/toolCatalog.js` está obsoleto e será removido. Use `src/ai/actionRegistry.js`.');

// Converte o novo formato de actions para o formato antigo de TOOLS para compatibilidade
const actions = getAllActions();
const TOOLS = {};
actions.forEach((action, name) => {
  TOOLS[name] = {
    description: action.description,
    params: action.parameters
  };
});

module.exports = {
  TOOLS,
  getToolCatalogForPrompt: getActionsForPrompt,
};