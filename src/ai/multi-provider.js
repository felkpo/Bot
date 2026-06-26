const fetch = global.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config/config');

const GeminiProvider = require('./gemini-provider');
const GroqProvider = require('./groq-provider');
const WorkersProvider = require('./workers-provider');
const openrouter = require('./openrouter');

// ═══════════════════════════════════════════════════════════════════════════════
// ESTATÍSTICAS DE PROVEDORES — persistência em data/provider-stats.json
// ═══════════════════════════════════════════════════════════════════════════════
const PROVIDER_STATS_FILE = path.join(__dirname, '..', '..', 'data', 'provider-stats.json');
const PROVIDER_STATS_DEBOUNCE_MS = 30000;

const providerStats = {};
let providerStatsTimer = null;
let providerStatsDirty = false;

function loadProviderStats() {
  try {
    if (!fs.existsSync(PROVIDER_STATS_FILE)) return;
    const raw = fs.readFileSync(PROVIDER_STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    Object.assign(providerStats, parsed);
    logger.info('[PROVIDER STATS LOAD] Estatísticas de provedores carregadas', {
      arquivo: PROVIDER_STATS_FILE
    });
  } catch (error) {
    logger.error('[PROVIDER STATS LOAD ERROR]', { error: error.message });
  }
}

function scheduleProviderStatsPersist() {
  providerStatsDirty = true;
  if (providerStatsTimer) clearTimeout(providerStatsTimer);
  providerStatsTimer = setTimeout(persistProviderStats, PROVIDER_STATS_DEBOUNCE_MS);
}

function persistProviderStats() {
  try {
    const dir = path.dirname(PROVIDER_STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROVIDER_STATS_FILE, JSON.stringify(providerStats, null, 2), 'utf8');
    providerStatsDirty = false;
    logger.info('[PROVIDER STATS PERSIST] Estatísticas salvas em disco', { arquivo: PROVIDER_STATS_FILE });
  } catch (error) {
    logger.error('[PROVIDER STATS PERSIST ERROR]', { error: error.message });
  }
}

function getOrInitProviderStats(provider) {
  if (!providerStats[provider]) {
    providerStats[provider] = { success: 0, failed: 0, cooldowns: 0, totalResponseTime: 0, calls: 0 };
  }
  return providerStats[provider];
}

function recordProviderSuccess(provider, responseTimeMs) {
  const s = getOrInitProviderStats(provider);
  s.success += 1;
  s.totalResponseTime += responseTimeMs;
  s.calls += 1;
  scheduleProviderStatsPersist();
}

function recordProviderFailure(provider) {
  const s = getOrInitProviderStats(provider);
  s.failed += 1;
  s.calls += 1;
  scheduleProviderStatsPersist();
}

function recordProviderCooldown(provider) {
  const s = getOrInitProviderStats(provider);
  s.cooldowns += 1;
  s.failed += 1;
  s.calls += 1;
  scheduleProviderStatsPersist();
}

function getProviderStatsSnapshot() {
  return JSON.parse(JSON.stringify(providerStats));
}

// ═══════════════════════════════════════════════════════════════════════════════
// COOLDOWNS DE PROVEDORES
// ═══════════════════════════════════════════════════════════════════════════════
const providerCooldowns = new Map();
const PROVIDER_COOLDOWN_MS = 60 * 60 * 1000;

function isProviderInCooldown(provider) {
  const until = providerCooldowns.get(provider);
  if (!until) return false;
  if (Date.now() >= until) {
    providerCooldowns.delete(provider);
    return false;
  }
  return true;
}

function setProviderCooldown(provider, durationMs = PROVIDER_COOLDOWN_MS) {
  const until = Date.now() + durationMs;
  providerCooldowns.set(provider, until);
  recordProviderCooldown(provider);
  logger.info('[PROVIDER COOLDOWN]', {
    provider,
    until: new Date(until).toISOString(),
    durationMin: Math.round(durationMs / 60000),
    reason: '429 rate limit / quota exceeded',
    arquivo: 'src/ai/multi-provider.js'
  });
}

function getActiveProviderCooldowns() {
  const now = Date.now();
  const result = {};
  for (const [p, until] of providerCooldowns.entries()) {
    result[p] = { until: new Date(until).toISOString(), remainingMin: Math.round((until - now) / 60000) };
  }
  return result;
}

// Carrega estatísticas
loadProviderStats();

// ═══════════════════════════════════════════════════════════════════════════════
// ORQUESTRADOR MULTI-PROVEDOR
// ═══════════════════════════════════════════════════════════════════════════════
class MultiProviderClient {
  constructor() {
    this.gemini = new GeminiProvider();
    this.groq = new GroqProvider();
    this.workers = new WorkersProvider();
    this.openrouter = openrouter;

    this.providers = [
      this.gemini,
      this.groq,
      this.workers,
      this.openrouter
    ].sort((a, b) => a.priority - b.priority);

    this.initialized = this.initialize();
  }

  /**
   * Inicializa um único provider de forma resiliente.
   * Suporta providers com init(), initialize(), ensureInitialized() ou sem método de init.
   */
  async initializeProvider(provider) {
    const providerName = provider.constructor?.name || provider.name || 'unknown';

    // Log diagnóstico detalhado
    logger.info('[PROVIDER INIT DEBUG]', {
      providerName,
      methods: Object.keys(provider || {}),
      hasInit: typeof provider.init === 'function',
      hasInitialize: typeof provider.initialize === 'function',
      hasEnsureInitialized: typeof provider.ensureInitialized === 'function',
      hasHealthCheck: typeof provider.healthCheck === 'function',
      hasTestConnectivity: typeof provider.testConnectivity === 'function',
      hasGenerateResponse: typeof provider.generateResponse === 'function',
      hasGenerate: typeof provider.generate === 'function'
    });

    try {
      // Tenta init() — padrão dos providers baseados em classe
      if (typeof provider.init === 'function') {
        await provider.init();
        logger.info('[PROVIDER INIT SUCCESS]', { provider: providerName });
        return true;
      }

      // Tenta initialize() — alternativa comum
      if (typeof provider.initialize === 'function') {
        await provider.initialize();
        logger.info('[PROVIDER INIT SUCCESS]', { provider: providerName });
        return true;
      }

      // Tenta ensureInitialized() — padrão do OpenRouter
      if (typeof provider.ensureInitialized === 'function') {
        await provider.ensureInitialized();
        logger.info('[PROVIDER INIT SUCCESS]', { provider: providerName });
        return true;
      }

      // Tenta testConnectivity() — health check do OpenRouter
      if (typeof provider.testConnectivity === 'function') {
        const ok = await provider.testConnectivity();
        if (ok) {
          logger.info('[PROVIDER INIT SUCCESS]', { provider: providerName, method: 'testConnectivity' });
          return true;
        }
        logger.warn('[PROVIDER INIT FAILED]', { provider: providerName, reason: 'testConnectivity_failed' });
        return false;
      }

      // Provider sem método de inicialização — assume que já está pronto
      logger.warn('[PROVIDER INIT]', {
        provider: providerName,
        reason: 'no_init_method'
      });
      return true;
    } catch (error) {
      logger.error('[PROVIDER INIT FAILED]', {
        provider: providerName,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  async initialize() {
    try {
      logger.info('📋 Inicializando sistema multi-provedor de IA...');

      const loadedProviders = this.providers.map(p => p.constructor?.name || p.name || 'unknown');
      logger.info('[PROVIDER REGISTRY]', { loadedProviders });

      const availableProviders = [];
      const disabledProviders = [];

      for (const provider of this.providers) {
        const providerName = provider.constructor?.name || provider.name || 'unknown';
        const success = await this.initializeProvider(provider);
        const hasApiKey = Boolean(provider.apiKey || (provider.isOnline !== undefined ? provider.isOnline : true));
        const cooldown = isProviderInCooldown(providerName);
        const enabled = success && provider.isAvailable !== false && hasApiKey;

        logger.info('[PROVIDER STATUS]', {
          provider: providerName,
          enabled: enabled,
          initialized: success,
          cooldown: cooldown,
          hasApiKey: hasApiKey
        });

        if (enabled) {
          availableProviders.push(providerName);
        } else {
          disabledProviders.push(providerName);
        }
      }

      logger.info('[PROVIDER STARTUP SUMMARY]', {
        availableProviders: availableProviders.join(', ') || 'none',
        disabledProviders: disabledProviders.join(', ') || 'none',
        totalProviders: this.providers.length,
        availableCount: availableProviders.length,
        disabledCount: disabledProviders.length
      });

      // testConnectivity() agora é chamado dentro de initializeProvider() com retry
      // Não chamamos aqui para evitar duplicação
    } catch (error) {
      logger.error('[MultiProvider] Falha ao inicializar', { error: error.message, stack: error.stack });
    }
  }

  async ensureInitialized() {
    return this.initialized;
  }

  async healthCheck() {
    await this.ensureInitialized();
    const available = this.providers.filter(p => p.isAvailable && !isProviderInCooldown(p.name));
    return available.length > 0;
  }

  getModelInfo() {
    // Retorna info do primeiro provedor disponível
    for (const p of this.providers) {
      if (p.isAvailable && typeof p.getModelInfo === 'function') {
        const info = p.getModelInfo();
        if (info) return { ...info, provider: p.name };
      }
    }
    return { provider: 'MultiProvider', name: 'fallback', provider: 'multi' };
  }

  // Strip reasoning mantido do OpenRouter
  stripReasoning(text) {
    if (!text || typeof text !== 'string') return text;
    return this.openrouter.stripReasoning(text);
  }

  buildMessages(userMessage, context = {}) {
    // Delega para OpenRouter que já tem toda a lógica de prompt/action
    return this.openrouter.buildMessages(userMessage, context);
  }

  /**
   * Gera resposta usando fallback entre provedores
   */
  async generateResponse(userMessage, context = {}, timeoutMs = config.AI?.messageTimeout || 30000) {
    await this.ensureInitialized();

    if (context.isActionMode) {
      context.history = [];
      context.userMemory = '';
      context.channelMemory = '';
      context.serverMemory = '';
    }

    const messages = this.buildMessages(userMessage, context);
    
    if (context.isActionMode) {
      const sysPrompt = messages.find(m => m.role === 'system')?.content || '';
      logger.info('[ACTION MODE FULL PROMPT]', {
        systemPrompt: sysPrompt,
        userMessage: userMessage,
        contextSummary: {
          historyLength: context.history?.length || 0,
          hasUserMemory: !!context.userMemory,
          isActionMode: context.isActionMode
        }
      });
      logger.info('[ACTION MODE MODEL INPUT]', {
        system: sysPrompt,
        user: userMessage,
        history: context.history || []
      });
    }

    const allProviders = this.providers.map(p => p.name);
    const disabledProviders = this.providers.filter(p => !p.isAvailable).map(p => p.name);
    const cooldownProviders = Object.keys(getActiveProviderCooldowns());
    const availableProviders = this.providers.filter(p => p.isAvailable && !isProviderInCooldown(p.name));

    const attemptedProviders = [];
    const failedProvidersDetails = [];

    if (availableProviders.length === 0) {
      const errorDetails = {
        attemptedProviders,
        availableProviders: availableProviders.map(p => p.name),
        cooldownProviders,
        disabledProviders,
        failedProviders: failedProvidersDetails
      };
      logger.error('[GLOBAL AI FAILURE] Todos os provedores indisponíveis ou em cooldown', {
        ...errorDetails,
        arquivo: 'src/ai/multi-provider.js'
      });
      const err = new Error('GLOBAL_AI_FAILURE');
      err.isGlobalAiFailure = true;
      err.details = errorDetails;
      err.providerStatuses = this.getProviderStatuses();
      throw err;
    }

    logger.info('[PROVIDER ORCHESTRATOR] Iniciando cadeia de fallback', {
      provedoresDisponiveis: availableProviders.map(p => p.name).join(' → '),
      arquivo: 'src/ai/multi-provider.js'
    });

    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i];
      const attemptNum = i + 1;

      logger.info('[PROVIDER ATTEMPT]', {
        provider: provider.name,
        attempt: attemptNum,
        totalAvailable: availableProviders.length,
        arquivo: 'src/ai/multi-provider.js'
      });

      // Inside loop update
      attemptedProviders.push(provider.name);
      
      // Suporta tanto generate() (Gemini/Groq/Workers) quanto generateResponse() (OpenRouter)
      let result;
      if (typeof provider.generate === 'function') {
        result = await provider.generate(userMessage, messages, timeoutMs);
      } else if (typeof provider.generateResponse === 'function') {
        result = await provider.generateResponse(userMessage, context, timeoutMs);
        // Normaliza o retorno do OpenRouter para o formato esperado
        if (typeof result === 'string') {
          result = { ok: true, text: result, tokens: 0, ms: 0, model: provider.name };
        }
      } else {
        logger.error('[PROVIDER ERROR] Provider não tem método generate nem generateResponse', {
          provider: provider.name
        });
        continue;
      }

      if (result.ok) {
        let cleaned = this.stripReasoning(result.text);

        // VALIDADOR DE QUALIDADE DOS PROVIDERS
        let isBadResponse = false;
        let validationReason = '';

        if (context.isActionMode) {
          const lowerResponse = cleaned.toLowerCase();
          const refusals = [
            'não tenho permissão', 'nao tenho permissao',
            'não posso fazer isso', 'nao posso fazer isso',
            'não consigo executar', 'nao consigo executar',
            'esse comando não existe', 'esse comando nao existe',
            'sou um bot', 'gerenciamento de grupos'
          ];

          for (const refusal of refusals) {
            if (lowerResponse.includes(refusal)) {
              isBadResponse = true;
              validationReason = `containsRefusal:${refusal}`;
              break;
            }
          }

          if (!isBadResponse) {
            // Validate JSON parsing
            const toolManager = require('./toolManager');
            const parsed = toolManager.tryParseStructuredResponse(cleaned);
            if (!parsed) {
              isBadResponse = true;
              validationReason = 'invalidJson';
            } else if (!parsed.action) {
              isBadResponse = true;
              validationReason = 'noAction';
            }
          }

          logger.info('[ACTION RESPONSE VALIDATION]', {
            provider: provider.name,
            jsonValid: !isBadResponse || validationReason !== 'invalidJson',
            actionDetected: !isBadResponse || validationReason !== 'noAction',
            containsRefusal: validationReason.startsWith('containsRefusal'),
            result: isBadResponse ? 'REJECTED' : 'ACCEPTED',
            reason: validationReason
          });
        }

        if (isBadResponse) {
          // Treated as a failure for fallback purposes
          logger.warn('[ACTION PROVIDER RETRY]', {
            failedProvider: provider.name,
            nextProvider: availableProviders[i + 1]?.name || 'none',
            reason: validationReason,
            responsePreview: cleaned.substring(0, 100)
          });
          result.ok = false;
          result.retryable = true;
          result.reason = validationReason;
          recordProviderFailure(provider.name);
        } else {
          recordProviderSuccess(provider.name, result.ms);

          logger.info('[PROVIDER SUCCESS]', {
            provider: provider.name,
            model: result.model,
            responseTime: result.ms,
            responseTimeSeconds: (result.ms / 1000).toFixed(2),
            tokens: result.tokens,
            arquivo: 'src/ai/multi-provider.js'
          });
          return cleaned;
        }
      }

      logger.info('[PROVIDER FAILED]', {
        provider: provider.name,
        reason: result.reason,
        status: result.status,
        retryable: result.retryable,
        arquivo: 'src/ai/multi-provider.js'
      });

      failedProvidersDetails.push({ name: provider.name, reason: result.reason || 'error' });

      // Se o provedor falhou por rate limit, coloca em cooldown
      if (result.status === 429 || (result.retryable && result.reason === 'rate_limit')) {
        setProviderCooldown(provider.name);
        logger.info('[PROVIDER FALLBACK]', {
          from: provider.name,
          to: availableProviders[i + 1]?.name || 'none',
          reason: result.reason || '429',
          arquivo: 'src/ai/multi-provider.js'
        });
        continue;
      }

      // Se falhou por erro retryable (5xx, timeout, ou BAD RESPONSE), tenta próximo
      if (result.retryable && i < availableProviders.length - 1) {
        logger.info('[PROVIDER FALLBACK]', {
          from: provider.name,
          to: availableProviders[i + 1]?.name || 'none',
          reason: result.reason || 'error',
          arquivo: 'src/ai/multi-provider.js'
        });
        continue;
      }

      // Se o provedor falhou completamente (all_models_failed), tenta próximo
      if (result.reason === 'all_models_failed' && i < availableProviders.length - 1) {
        logger.info('[PROVIDER FALLBACK]', {
          from: provider.name,
          to: availableProviders[i + 1]?.name || 'none',
          reason: 'all_models_failed',
          arquivo: 'src/ai/multi-provider.js'
        });
        continue;
      }

      // Para provedores que não são OpenRouter, se falhou por erro não retryable, tenta próximo
      if (i < availableProviders.length - 1) {
        logger.info('[PROVIDER FALLBACK]', {
          from: provider.name,
          to: availableProviders[i + 1]?.name || 'none',
          reason: result.reason || 'error',
          arquivo: 'src/ai/multi-provider.js'
        });
        continue;
      }

      // OpenRouter é o último - se chegou aqui, ele já tratou seus erros internos
      if (provider.name === 'OpenRouter') {
        recordProviderFailure(provider.name);
        const errorDetails = {
          attemptedProviders,
          availableProviders: availableProviders.map(p => p.name),
          cooldownProviders,
          disabledProviders,
          failedProviders: failedProvidersDetails
        };
        const err = new Error('GLOBAL_AI_FAILURE');
        err.isGlobalAiFailure = true;
        err.details = errorDetails;
        err.providerStatuses = this.getProviderStatuses();
        throw err;
      }
    }

    // Todos falharam
    const errorDetails = {
      attemptedProviders,
      availableProviders: availableProviders.map(p => p.name),
      cooldownProviders,
      disabledProviders,
      failedProviders: failedProvidersDetails
    };
    logger.error('[GLOBAL AI FAILURE] Todos os provedores falharam', {
      ...errorDetails,
      arquivo: 'src/ai/multi-provider.js'
    });
    const err = new Error('GLOBAL_AI_FAILURE');
    err.isGlobalAiFailure = true;
    err.details = errorDetails;
    err.providerStatuses = this.getProviderStatuses();
    throw err;
  }

  // Expõe métodos para compatibilidade
  getProviderStatsSnapshot() {
    return getProviderStatsSnapshot();
  }

  getActiveProviderCooldowns() {
    return getActiveProviderCooldowns();
  }

  getAvailableProviders() {
    return this.providers.filter(p => p.isAvailable).map(p => p.name);
  }

  getProviderStatuses() {
    return this.providers.map(p => {
      const cooldown = isProviderInCooldown(p.name);
      let status = 'Online';
      if (!p.isAvailable) status = 'Offline';
      if (!p.apiKey && typeof p.isOnline === 'undefined') status = 'Offline (No API Key)';
      if (cooldown) {
        const cooldowns = getActiveProviderCooldowns();
        const info = cooldowns[p.name];
        status = `Cooldown (${info ? info.remainingMin : '?'} min)`;
      }
      return {
        name: p.name,
        status: status,
        isAvailable: p.isAvailable && !cooldown
      };
    });
  }
}

module.exports = new MultiProviderClient();
