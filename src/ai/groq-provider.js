const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');

const GROQ_MODEL_POOL = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'deepseek-r1-distill-llama-70b',
  'qwen-qwq-32b',
  'gemma2-9b-it',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma-7b-it',
  'llama-guard-3-8b'
];

class GroqProvider {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.isAvailable = false;
    this.activePool = [...GROQ_MODEL_POOL];
  }

  get name() { return 'Groq'; }
  get priority() { return 2; }

  async init() {
    if (!this.apiKey) {
      logger.warn('[Groq] API key não configurada — provedor desativado');
      return;
    }
    this.isAvailable = true;
    logger.info('[Groq] Provedor inicializado', { models: this.activePool.length });
  }

  isRetryableError(status, errorMessage) {
    return [429, 500, 502, 503, 504].includes(status) ||
      String(errorMessage).toLowerCase().includes('quota') ||
      String(errorMessage).toLowerCase().includes('rate limit') ||
      String(errorMessage).toLowerCase().includes('timeout');
  }

  async generate(userMessage, messages, timeoutMs) {
    if (!this.isAvailable || !this.apiKey) {
      return { ok: false, reason: 'not_available', status: 0 };
    }

    const lastModel = this.activePool.length - 1;

    for (let i = 0; i < this.activePool.length; i++) {
      const model = this.activePool[i];
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();

      try {
        const res = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7,
              top_p: 0.9,
              max_tokens: 1024,
              reasoning: { enabled: false }
            })
          }
        );
        clearTimeout(id);
        const ms = Date.now() - startTime;

        if (res.status === 429) {
          logger.info('[Groq] Rate limit no modelo', { model, status: 429 });
          if (i === lastModel) return { ok: false, reason: 'rate_limit', status: 429, retryable: true };
          continue;
        }
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          logger.info('[Groq] Modelo falhou', { model, status: res.status });
          if (i === lastModel) return { ok: false, reason: String(res.status), status: res.status, apiMessage: errBody.substring(0, 200), retryable: this.isRetryableError(res.status, errBody) };
          continue;
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (!text.trim()) {
          logger.info('[Groq] Resposta vazia', { model });
          if (i === lastModel) return { ok: false, reason: 'empty', status: 200 };
          continue;
        }
        const tokens = data.usage?.total_tokens || 0;
        return { ok: true, text, tokens, ms, model };
      } catch (error) {
        clearTimeout(id);
        const ms = Date.now() - startTime;
        const reason = String(error.code || error.name || 'unknown').toLowerCase();
        logger.info('[Groq] Erro', { model, error: error.message, reason });
        if (i === lastModel) return { ok: false, reason, status: 0, retryable: true };
      }
    }
    return { ok: false, reason: 'all_models_failed', status: 0 };
  }
}

module.exports = GroqProvider;