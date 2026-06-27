/**
 * ACTION DISCOVERY
 *
 * Este módulo é responsável por escanear o sistema de arquivos em busca de
 * definições de actions e registrá-las automaticamente no ActionRegistry.
 * Isso elimina a necessidade de registrar manualmente cada nova capacidade.
 *
 * @file src/core/actionDiscovery.js
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { registerAction } = require('../ai/actionRegistry');
const actionExecutor = require('../ai/actionExecutor');

const ACTION_DIRECTORIES = [
  path.join(__dirname, '..', 'actions'),
  // Adicionar aqui o diretório de plugins no futuro
  // path.join(__dirname, '..', '..', 'plugins'),
];

/**
 * Escaneia recursivamente os diretórios em busca de arquivos de action e os registra.
 */
function discoverAndRegisterActions() {
  logger.info('[ACTION DISCOVERY] Iniciando varredura de actions...');
  let registeredCount = 0;

  ACTION_DIRECTORIES.forEach(dir => {
    if (!fs.existsSync(dir)) {
      logger.debug(`[ACTION DISCOVERY] Diretório não encontrado, pulando: ${dir}`);
      return;
    }

    const files = fs.readdirSync(dir).filter(file => file.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const actionModule = require(filePath);

        // A V3 espera que o módulo exporte um objeto `metadata`
        if (actionModule && actionModule.metadata && typeof actionModule.metadata === 'object') {
          registerAction(actionModule.metadata);
          logger.debug(`[ACTION DISCOVERY] Action registrada a partir de ${file}`);
          registeredCount++;
        }
      } catch (error) {
        logger.error(`[ACTION DISCOVERY] Falha ao carregar action de ${filePath}`, { error: error.message });
      }
    }
  });

  logger.info(`[ACTION DISCOVERY] Concluído. ${registeredCount} actions foram descobertas e registradas.`);
}

module.exports = { discoverAndRegisterActions };