const logger = require('../utils/logger');
const config = require('./config');

function validateProviders() {
  logger.info('[CONFIG VALIDATION] Iniciando validação de providers...');
  const providers = config.providers || {};
  const providerNames = Object.keys(providers);
  let allValid = true;

  if (providerNames.length === 0) {
    logger.warn('[CONFIG VALIDATION] Nenhum provider configurado em `config.providers`');
    return true; // Not a fatal error if no providers are defined
  }

  const foundProviders = [];
  const missingConfigs = [];

  for (const name of providerNames) {
    const providerConfig = providers[name];
    let isValid = true;
    if (!providerConfig) {
      logger.error(`[CONFIG VALIDATION FAILED] Configuração para o provider "${name}" está nula ou indefinida.`);
      allValid = false;
      isValid = false;
      missingConfigs.push({ provider: name, reason: 'Config object is missing' });
      continue;
    }

    // Validation logic per provider
    if (name === 'openrouter' && !providerConfig.apiKey) {
      isValid = false;
      missingConfigs.push({ provider: name, key: 'apiKey' });
    }
    if (name === 'gemini' && !providerConfig.apiKey) {
      isValid = false;
      missingConfigs.push({ provider: name, key: 'apiKey' });
    }
    if (name === 'groq' && !providerConfig.apiKey) {
      isValid = false;
      missingConfigs.push({ provider: name, key: 'apiKey' });
    }
    if (name === 'workersai' && (!providerConfig.apiKey || !providerConfig.accountId)) {
      isValid = false;
      const missing = [];
      if (!providerConfig.apiKey) missing.push('apiKey');
      if (!providerConfig.accountId) missing.push('accountId');
      missingConfigs.push({ provider: name, keys: missing });
    }
    if (name === 'ollama' && !providerConfig.url) {
      isValid = false;
      missingConfigs.push({ provider: name, key: 'url' });
    }

    if (isValid) {
      foundProviders.push(`✔ ${name}`);
    } else {
      foundProviders.push(`✖ ${name}`);
      allValid = false;
    }
  }

  if (foundProviders.length > 0) {
    logger.info('[CONFIG VALIDATION] Providers encontrados:');
    foundProviders.forEach(p => logger.info(p));
  }

  if (!allValid) {
    logger.error('[CONFIG VALIDATION FAILED] Chaves de configuração ausentes:');
    missingConfigs.forEach(mc => {
      if (mc.keys) {
        logger.error(`- Provider: ${mc.provider}, Chaves ausentes: ${mc.keys.join(', ')}`);
      } else if (mc.key) {
        logger.error(`- Provider: ${mc.provider}, Chave ausente: ${mc.key}`);
      } else {
        logger.error(`- Provider: ${mc.provider}, Razão: ${mc.reason}`);
      }
    });
    // Optionally, you could throw an error here to halt execution
    // throw new Error('Configuração de provider inválida. Verifique os logs.');
  } else {
    logger.info('[CONFIG VALIDATION] Todos os providers configurados corretamente.');
  }

  return allValid;
}

function runValidation() {
  logger.info('[CONFIG LOAD] Configuração carregada.');
  validateProviders();
  // Add more validation functions here if needed
}

module.exports = { runValidation };
