/**
 * ACTION DISCOVERY
 *
 * Este módulo é responsável por escanear o sistema de arquivos em busca de
 * definições de actions e registrá-las automaticamente no ActionRegistry.
 * Isso elimina a necessidade de registrar manualmente cada nova capacidade.
 *
 * @file src/ai/actionDiscovery.js
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { registerAction } = require('../ai/actionRegistry');

const ACTION_DIRECTORIES = [
  path.join(__dirname, '..', 'actions'),
  path.join(__dirname, '..', 'events'), // As definições de Actions estão neste diretório
  path.join(__dirname, '..', '..', 'plugins'),
];

/**
 * Escaneia um diretório recursivamente em busca de arquivos de action.
 * @param {string} directory - O diretório para escanear.
 * @param {{count: number}} stats - Objeto para contagem de actions registradas.
 */
function scanDirectory(directory, stats) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, stats);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const actionModule = require(fullPath);

        // A V3 espera que o módulo exporte um objeto `metadata`
        if (actionModule && actionModule.metadata && typeof actionModule.metadata === 'object') {
          registerAction(actionModule.metadata);
          logger.debug(`[ACTION DISCOVERY] Action registrada a partir de ${entry.name}`);
          stats.count++;
        }
      } catch (error) {
        logger.error(`[ACTION DISCOVERY] Falha ao carregar action de ${fullPath}`, { error: error.message });
      }
    }
  }
}

/**
 * Inicia a varredura dos diretórios de actions e as registra.
 */
function discoverAndRegisterActions() {
  logger.info('[ACTION DISCOVERY] Iniciando varredura de actions...');
  const stats = { count: 0 };

  ACTION_DIRECTORIES.forEach(dir => {
    if (!fs.existsSync(dir)) {
      logger.debug(`[ACTION DISCOVERY] Diretório não encontrado, pulando: ${dir}`);
      return;
    }
    scanDirectory(dir, stats);
  });

  logger.info(`[ACTION DISCOVERY] Concluído. ${stats.count} actions foram descobertas e registradas.`);
}

module.exports = { discoverAndRegisterActions };