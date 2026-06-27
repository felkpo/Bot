/**
 * ACTION RESOLVER
 *
 * Responsável por pegar a intenção da IA (o nome de uma ação) e encontrar
 * a definição completa dessa ação no registro. Ele também resolve aliases.
 *
 * @file src/ai/actionResolver.js
 */

const logger = require('../utils/logger');
const { getAction, getAllActions } = require('./actionRegistry');

/**
 * @typedef {import('./actionRegistry').Action} Action
 */

const aliasMap = new Map();
let isAliasMapInitialized = false;

function initializeAliasMap() {
    if (isAliasMapInitialized) return;
    logger.debug('[ACTION RESOLVER] Inicializando mapa de aliases...');
    const actions = getAllActions();
    actions.forEach(action => {
        if (action.aliases && action.aliases.length > 0) {
            action.aliases.forEach(alias => {
                if (aliasMap.has(alias)) {
                    logger.warn(`[ACTION RESOLVER] Alias '${alias}' está duplicado.`);
                }
                aliasMap.set(alias.toLowerCase(), action.name);
            });
        }
    });
    isAliasMapInitialized = true;
    logger.info(`[ACTION RESOLVER] Mapa de aliases inicializado com ${aliasMap.size} aliases.`);
}

/**
 * Encontra uma ação pelo nome ou alias.
 * @param {string} actionName - O nome da ação ou um de seus aliases.
 * @returns {Action|undefined} A definição da ação encontrada.
 */
function resolveAction(actionName) {
    if (!isAliasMapInitialized) initializeAliasMap();

    const directMatch = getAction(actionName);
    if (directMatch) return directMatch;

    const aliasMatchName = aliasMap.get(actionName.toLowerCase());
    if (aliasMatchName) return getAction(aliasMatchName);

    logger.warn('[ACTION NOT FOUND]', { actionName });
    return undefined;
}

module.exports = { resolveAction };