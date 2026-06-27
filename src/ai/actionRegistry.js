/**
 * ACTION REGISTRY V3 — SINGLE SOURCE OF TRUTH (METADATA ONLY)
 *
 * Este módulo centraliza todas as "ações" ou "ferramentas" que a IA pode executar.
 * Esta é a versão 3, que serve como um catálogo de metadados puro e desacoplado.
 * Este arquivo contém APENAS os metadados da ação (nome, descrição, parâmetros, etc.).
 *
 * A lógica de execução está em `src/ai/actionExecutor.js`.
 * O objetivo é permitir que a IA (via Function Calling) possa autonomamente
 * escolher e executar qualquer capacidade registrada aqui.
 *
 * @file src/ai/actionRegistry.js
 */

const logger = require('../utils/logger');
const { PermissionsBitField } = require('discord.js');
const { isAdmin, resolveTarget } = require('../utils/helpers');

/**
 * @typedef {object} ActionParameter
 * @property {'string'|'number'|'boolean'|'user'|'role'|'channel'} type - O tipo do parâmetro.
 * @property {string} description - Descrição do que o parâmetro representa.
 * @property {boolean} [required=true] - Se o parâmetro é obrigatório.
 */

/**
 * @typedef {object} Action
 * @property {string} name - O nome da ação (ex: "sendMessage").
 * @property {string} description - Descrição clara do que a ação faz.
 * @property {string} category - Categoria da ação (ex: 'Moderação', 'Mensagens').
 * @property {string} [subCategory] - Sub-categoria para agrupamento mais fino.
 * @property {string[]} [aliases=[]] - Nomes alternativos para a ação.
 * @property {Object.<string, ActionParameter>} parameters - Dicionário de parâmetros.
 * @property {string[]} [examples=[]] - Exemplos de como a IA pode chamar a ação.
 * @property {string[]} [permissions=[]] - Permissões de Discord necessárias para o *bot*.
 * @property {Function} [userPermissionsCheck] - Função para verificar permissões do *usuário*. (message) => boolean.
 * @property {string} [returnType='string'] - O tipo de dado que o executor retorna.
 * @property {'low'|'medium'|'high'|'critical'} [riskLevel='low'] - Nível de risco da ação.
 * @property {boolean} [guildOnly=true] - Se a ação só pode ser executada em um servidor.
 * @property {boolean} [ownerOnly=false] - Se a ação só pode ser executada pelo dono do bot.
 * @property {boolean} [adminOnly=false] - Se a ação só pode ser executada por administradores do servidor.
 * @property {boolean} [requiresConfirmation=false] - Se a ação exige confirmação explícita.
 * @property {string} executorName - Nome da função no `actionExecutor.js` que implementa esta ação.
 * @property {string} [version='1.0'] - Versão da definição da ação.
 * @property {string[]} [tags=[]] - Tags para busca e agrupamento.
 * @property {string} [documentation] - Link para a documentação da ação.
 */

/** @type {Map<string, Action>} */
const actions = new Map();

/**
 * Registra uma nova ação no sistema.
 * @param {Action} actionConfig - A configuração completa da ação.
 */
function registerAction(actionConfig) {
  if (!actionConfig || !actionConfig.name) {
    logger.error('[ACTION REGISTRY] Tentativa de registrar ação inválida.', actionConfig);
    return;
  }

  if (actions.has(actionConfig.name)) {
    logger.warn(`[ACTION REGISTRY] Ação "${actionConfig.name}" já registrada. Sobrescrevendo.`);
  }

  // Validações básicas
  actionConfig.category = actionConfig.category || 'Outros';
  actionConfig.permissions = actionConfig.permissions || [];
  actionConfig.aliases = actionConfig.aliases || [];
  actionConfig.examples = actionConfig.examples || [];
  actionConfig.riskLevel = actionConfig.riskLevel || 'low';
  actionConfig.executorName = actionConfig.executorName || actionConfig.name;

  // Inferir `requiresConfirmation` a partir do `riskLevel` se não for definido
  actionConfig.requiresConfirmation = actionConfig.requiresConfirmation ?? (actionConfig.riskLevel === 'high' || actionConfig.riskLevel === 'critical');
  actionConfig.userPermissionsCheck = actionConfig.userPermissionsCheck || (() => true); // Permitido por padrão se não especificado

  actions.set(actionConfig.name, actionConfig);
  logger.debug(`[ACTION REGISTRY] Ação registrada: ${actionConfig.name}`);
}

/**
 * Retorna uma ação pelo nome.
 * @param {string} name
 * @returns {Action|undefined}
 */
function getAction(name) {
  return actions.get(name);
}

/**
 * Retorna todas as ações registradas.
 * @returns {Map<string, Action>}
 */
function getAllActions() {
  return actions;
}

/**
 * Gera uma representação em texto do catálogo de ferramentas para ser injetada no prompt do LLM.
 * Usado para LLMs que não suportam `tool_calls` nativo.
 * @returns {string} O catálogo de ferramentas formatado.
 */
function getActionsForPrompt() {
  let catalogText = '## CATÁLOGO DE AÇÕES DISPONÍVEIS (FORMATO JSON)\n\n';
  catalogText += 'Você pode executar as seguintes ações. Você DEVE usar o formato JSON para chamar uma delas. Verifique as permissões do usuário antes de sugerir uma ação restrita.\n\n';

  for (const [actionName, action] of actions.entries()) {
    catalogText += `### Ação: ${actionName}\n`;
    catalogText += `- Descrição: ${action.description}\n`;
    if (Object.keys(action.parameters).length > 0) {
      catalogText += `- Parâmetros:\n`;
      for (const paramName in action.parameters) {
        const param = action.parameters[paramName];
        const requiredText = param.required === false ? '(Opcional) ' : '';
        catalogText += `  - ${paramName} (${param.type}): ${requiredText}${param.description}\n`;
      }
    }
    if (action.examples.length > 0) {
      catalogText += `- Exemplos de uso:\n`;
      for (const example of action.examples) {
        catalogText += `  - "${example}"\n`;
      }
    }
    catalogText += '\n';
  }
  return catalogText;
}

/**
 * Gera uma representação das ações no formato de `tools` para LLMs com Function Calling nativo.
 * @returns {any[]} Um array de definições de ferramentas.
 */
function getActionsAsTools() {
  const tools = [];
  for (const action of actions.values()) {
    const properties = {};
    const required = [];

    if (action.parameters) {
      for (const paramName in action.parameters) {
        const param = action.parameters[paramName];
        properties[paramName] = {
          type: param.type === 'number' ? 'number' : 'string', // Simplificação para o formato de tool
          description: param.description,
        };
        if (param.required !== false) {
          required.push(paramName);
        }
      }
    }

    tools.push({
      type: 'function',
      function: {
        name: action.name,
        description: action.description,
        parameters: {
          type: 'object',
          properties: properties,
          required: required,
        },
      },
    });
  }
  return tools;
}


// =================================================================================
// REGISTRO DE AÇÕES
// Todas as capacidades do bot devem ser registradas aqui.
// O registro manual foi removido. As ações agora são carregadas
// dinamicamente pelo `actionDiscovery` na inicialização do bot.
// =================================================================================

module.exports = {
  registerAction,
  getAction,
  getAllActions,
  getActionsForPrompt,
  getActionsAsTools,
  actions,
};