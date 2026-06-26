/**
 * HELPERS DE USER ROLES
 * 
 * Centraliza toda a lógica de determinação de papéis/personalidades por usuário.
 * Agora usa userGroupManager (data/user-groups.json) como fonte única de dados.
 * 
 * Hierarquia (do maior para menor prioridade):
 * 1. Assistant Normal
 * 2. Admin Tester
 * 3. Tester
 * 4. Default
 * 
 * @file src/utils/userRoles.js
 */

const userGroupManager = require('../managers/userGroupManager');
const logger = require('./logger');

/**
 * Retorna o role de um usuário baseado nos grupos configurados.
 * Delega ao userGroupManager que lê de data/user-groups.json.
 * @param {string} userId - ID do usuário do Discord
 * @returns {string} - 'assistant_normal' | 'admin_tester' | 'tester' | 'default'
 */
function getUserRole(userId) {
  const role = userGroupManager.getUserRole(userId);
  logger.info('[USER ROLE LOOKUP]', {
    userId,
    role,
    arquivo: 'src/utils/userRoles.js'
  });
  return role;
}

/**
 * Verifica se o usuário é Assistant Normal
 * @param {string} userId
 * @returns {boolean}
 */
function isAssistantNormalUser(userId) {
  return userGroupManager.hasUser('normal', userId);
}

/**
 * Verifica se o usuário é Tester
 * @param {string} userId
 * @returns {boolean}
 */
function isTester(userId) {
  return userGroupManager.hasUser('tester', userId);
}

/**
 * Verifica se o usuário é Admin Tester
 * @param {string} userId
 * @returns {boolean}
 */
function isAdminTester(userId) {
  return userGroupManager.hasUser('admintester', userId);
}

module.exports = {
  getUserRole,
  isAssistantNormalUser,
  isTester,
  isAdminTester
};