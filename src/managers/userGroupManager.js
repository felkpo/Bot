/**
 * USER GROUP MANAGER
 * 
 * Gerencia grupos de usuários com persistência em data/user-groups.json.
 * Substitui completamente Sets hardcoded por gerenciamento dinâmico via arquivo.
 * 
 * Para adicionar/remover usuários, use os comandos do Discord:
 *   rp add <grupo> @usuario
 *   rp remove <grupo> @usuario
 * 
 * Grupos: akira, servant, normal, tester, admintester
 * @file src/managers/userGroupManager.js
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'user-groups.json');

// Estrutura padrão caso o arquivo não exista
const DEFAULT_GROUPS = {
  akiraUsers: [],
  servantUsers: [],
  assistantNormalUsers: [],
  testers: [],
  adminTesters: [],
};

// Cache em memória
let groups = null;

/**
 * Mapeamento de nomes de grupos (alias) para chaves internas
 */
const GROUP_ALIASES = {
  akira: 'akiraUsers',
  servant: 'servantUsers',
  normal: 'assistantNormalUsers',
  assistant: 'assistantNormalUsers',
  tester: 'testers',
  test: 'testers',
  admintester: 'adminTesters',
  admintest: 'adminTesters',
  admin_tester: 'adminTesters',
};

/**
 * Carrega os grupos do arquivo JSON.
 * Se o arquivo não existir, cria com estrutura padrão.
 */
function loadUserGroups() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // Garante que todas as chaves existam
      groups = {
        akiraUsers: parsed.akiraUsers || [],
        servantUsers: parsed.servantUsers || [],
        assistantNormalUsers: parsed.assistantNormalUsers || [],
        testers: parsed.testers || [],
        adminTesters: parsed.adminTesters || [],
      };
    } else {
      // Cria arquivo com estrutura padrão
      groups = { ...DEFAULT_GROUPS };
      saveUserGroups(true);
    }

    logger.info('[USER GROUP LOAD] Grupos carregados', {
      akiraUsers: groups.akiraUsers.length,
      servantUsers: groups.servantUsers.length,
      assistantNormalUsers: groups.assistantNormalUsers.length,
      testers: groups.testers.length,
      adminTesters: groups.adminTesters.length,
      arquivo: DATA_FILE
    });

    return groups;
  } catch (error) {
    logger.error('[USER GROUP LOAD ERROR]', { error: error.message, arquivo: DATA_FILE });
    groups = { ...DEFAULT_GROUPS };
    return groups;
  }
}

/**
 * Salva os grupos no arquivo JSON.
 * @param {boolean} [silent=false] - Se true, não faz log
 */
function saveUserGroups(silent = false) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(groups, null, 2), 'utf8');
    if (!silent) {
      logger.info('[USER GROUP SAVE] Grupos salvos', { arquivo: DATA_FILE });
    }
  } catch (error) {
    logger.error('[USER GROUP SAVE ERROR]', { error: error.message, arquivo: DATA_FILE });
  }
}

/**
 * Retorna o nome da chave interna do grupo a partir de um alias.
 * @param {string} groupName - Nome do grupo (ex: "tester", "normal")
 * @returns {string|null} - Chave interna ou null se inválido
 */
function resolveGroupKey(groupName) {
  if (!groupName) return null;
  const key = GROUP_ALIASES[groupName.toLowerCase().trim()];
  return key || null;
}

/**
 * Adiciona um usuário a um grupo.
 * @param {string} groupName - Nome do grupo (ex: "tester")
 * @param {string} userId - ID do usuário do Discord
 * @returns {object} - { success, message, group }
 */
function addUser(groupName, userId) {
  if (!groups) loadUserGroups();

  const key = resolveGroupKey(groupName);
  if (!key) {
    return { success: false, message: `Grupo inválido. Grupos disponíveis: akira, servant, normal, tester, admintester` };
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return { success: false, message: 'ID de usuário inválido.' };
  }

  const userIdClean = userId.trim();

  if (groups[key].includes(userIdClean)) {
    return { success: false, message: `Usuário ${userIdClean} já está no grupo "${groupName}".` };
  }

  groups[key].push(userIdClean);
  saveUserGroups();

  logger.info('[USER GROUP ADD]', {
    group: key,
    userId: userIdClean,
    arquivo: 'src/managers/userGroupManager.js'
  });

  return { success: true, message: `Usuário ${userIdClean} adicionado ao grupo "${groupName}".`, group: key };
}

/**
 * Remove um usuário de um grupo.
 * @param {string} groupName - Nome do grupo (ex: "tester")
 * @param {string} userId - ID do usuário do Discord
 * @returns {object} - { success, message, group }
 */
function removeUser(groupName, userId) {
  if (!groups) loadUserGroups();

  const key = resolveGroupKey(groupName);
  if (!key) {
    return { success: false, message: `Grupo inválido. Grupos disponíveis: akira, servant, normal, tester, admintester` };
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return { success: false, message: 'ID de usuário inválido.' };
  }

  const userIdClean = userId.trim();
  const index = groups[key].indexOf(userIdClean);

  if (index === -1) {
    return { success: false, message: `Usuário ${userIdClean} não está no grupo "${groupName}".` };
  }

  groups[key].splice(index, 1);
  saveUserGroups();

  logger.info('[USER GROUP REMOVE]', {
    group: key,
    userId: userIdClean,
    arquivo: 'src/managers/userGroupManager.js'
  });

  return { success: true, message: `Usuário ${userIdClean} removido do grupo "${groupName}".`, group: key };
}

/**
 * Verifica se um usuário está em um grupo específico.
 * @param {string} groupName - Nome do grupo
 * @param {string} userId - ID do usuário
 * @returns {boolean}
 */
function hasUser(groupName, userId) {
  if (!groups) loadUserGroups();
  const key = resolveGroupKey(groupName);
  if (!key || !userId) return false;
  return groups[key].includes(userId.trim());
}

/**
 * Retorna o role de um usuário baseado nos grupos.
 * Hierarquia: akira > servant > assistant_normal > admin_tester > tester > default
 * @param {string} userId - ID do usuário do Discord
 * @returns {string}
 */
function getUserRole(userId) {
  if (!groups) loadUserGroups();
  if (!userId) return 'default';

  const id = userId.trim();

  if (groups.akiraUsers.includes(id)) return 'akira';
  if (groups.servantUsers.includes(id)) return 'servant';
  if (groups.assistantNormalUsers.includes(id)) return 'assistant_normal';
  if (groups.adminTesters.includes(id)) return 'admin_tester';
  if (groups.testers.includes(id)) return 'tester';

  return 'default';
}

/**
 * Retorna a lista de IDs de um grupo.
 * @param {string} groupName - Nome do grupo
 * @returns {string[]}
 */
function getGroup(groupName) {
  if (!groups) loadUserGroups();
  const key = resolveGroupKey(groupName);
  if (!key) return [];
  return [...groups[key]];
}

/**
 * Retorna todos os grupos (cópia).
 * @returns {object}
 */
function getAllGroups() {
  if (!groups) loadUserGroups();
  return {
    akiraUsers: [...groups.akiraUsers],
    servantUsers: [...groups.servantUsers],
    assistantNormalUsers: [...groups.assistantNormalUsers],
    testers: [...groups.testers],
    adminTesters: [...groups.adminTesters],
  };
}

// Inicialização automática no require
loadUserGroups();

module.exports = {
  loadUserGroups,
  saveUserGroups,
  addUser,
  removeUser,
  hasUser,
  getUserRole,
  getGroup,
  getAllGroups,
  resolveGroupKey,
  GROUP_ALIASES
};