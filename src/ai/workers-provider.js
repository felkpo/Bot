const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config/config');

const WORKERS_MODEL_POOL = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/google/gemma-3-12b-it',
  '@cf/google/gemma-2-9b-it',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/qwen/qwen1.5-7b-chat-awq',
  '@cf/thebloke/discolm-german-7b-v1-awq'
];

class WorkersProvider {
  constructor() {
    const workersConfig = config.providers?.workersai;
    this.apiKey = workersConfig?.apiKey || '';
    this.accountId = workersConfig?.accountId || '';
    this.isAvailable = false;
    this.activePool = [...WORKERS_MODEL_POOL];
  }

  get name() { return 'WorkersAI'; }
  get priority() { return 3; }

  async init() {
    if (!this.apiKey || !this.accountId) {
      logger.warn('[WorkersAI] API key ou Account ID não configurados — provedor desativado');
      return;
    }
    this.isAvailable = true;
    logger.info('[WorkersAI] Provedor inicializado', { models: this.activePool.length, accountId: this.accountId });
  }

  isRetryableError(status, errorMessage) {
    return [429, 500, 502, 503, 504].includes(status) ||
      String(errorMessage).toLowerCase().includes('quota') ||
      String(errorMessage).toLowerCase().includes('rate limit') ||
      String(errorMessage).toLowerCase().includes('timeout');
  }

  async generate(userMessage, messages, timeoutMs) {
    if (!this.isAvailable || !this.apiKey || !this.accountId) {
      return { ok: false, reason: 'not_available', status: 0 };
    }

    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run`;

    for (let i = 0; i < this.activePool.length; i++) {
      const model = this.activePool[i];
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();

      try {
        const res = await fetch(
          `${baseUrl}/${model}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages,
              temperature: 0.7,
              top_p: 0.9,
              max_tokens: 1024,
              stream: false
            })
          }
        );
        clearTimeout(id);
        const ms = Date.now() - startTime;

        if (res.status === 429) {
          logger.info('[WorkersAI] Rate limit no modelo', { model, status: 429 });
          if (i === this.activePool.length - 1) return { ok: false, reason: 'rate_limit', status: 429, retryable: true };
          continue;
        }
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          logger.info('[WorkersAI] Modelo falhou', { model, status: res.status });
          if (i === this.activePool.length - 1) return { ok: false, reason: String(res.status), status: res.status, apiMessage: errBody.substring(0, 200), retryable: this.isRetryableError(res.status, errBody) };
          continue;
        }
        const data = await res.json();
        const text = data.result?.response || data.result || '';
        if (!text.trim()) {
          logger.info('[WorkersAI] Resposta vazia', { model });
          if (i === this.activePool.length - 1) return { ok: false, reason: 'empty', status: 200 };
          continue;
        }
        const tokens = (data.result?.usage?.total_tokens) || 0;
        return { ok: true, text, tokens, ms, model };
      } catch (error) {
        clearTimeout(id);
        const ms = Date.now() - startTime;
        const reason = String(error.code || error.name || 'unknown').toLowerCase();
        logger.info('[WorkersAI] Erro', { model, error: error.message, reason });
        if (i === this.activePool.length - 1) return { ok: false, reason, status: 0, retryable: true };
      }
    }
    return { ok: false, reason: 'all_models_failed', status: 0 };
  }
}

module.exports = WorkersProvider;