const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');

const GEMINI_MODEL_POOL = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.isAvailable = false;
    this.activePool = [...GEMINI_MODEL_POOL];
  }

  get name() { return 'Gemini'; }
  get priority() { return 1; }

  async init() {
    if (!this.apiKey) {
      logger.warn('[Gemini] API key não configurada — provedor desativado');
      return;
    }
    this.isAvailable = true;
    logger.info('[Gemini] Provedor inicializado', { models: this.activePool.length });
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

    const systemMessage = messages.find(m => m.role === 'system') || { content: '' };
    const historyMessages = messages.filter(m => m.role !== 'system');
    const isActionMode = systemMessage.content.includes('ACTION MODE');

    let contents = [];
    if (isActionMode) {
      contents = [{
        role: 'user',
        parts: [{ text: userMessage }]
      }];
    } else {
      contents = historyMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
    }

    const historyCount = Math.max(0, contents.length - 1);

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemMessage.content }]
      },
      contents: contents,
      generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 1024 }
    };

    logger.info('[GEMINI SYSTEM INSTRUCTION]', {
      length: systemMessage.content.length,
      preview: systemMessage.content.substring(0, 100).replace(/\n/g, ' ')
    });

    logger.info('[GEMINI USER MESSAGE]', {
      length: userMessage.length,
      preview: userMessage.substring(0, 100).replace(/\n/g, ' ')
    });

    logger.info('[GEMINI HISTORY COUNT]', {
      count: historyCount
    });

    if (isActionMode) {
      logger.info('[ACTION MODE ISOLATED]', {
        historyCount: 0
      });
    }

    const lastModel = this.activePool.length - 1;

    for (let i = 0; i < this.activePool.length; i++) {
      const model = this.activePool[i];
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );
        clearTimeout(id);
        const ms = Date.now() - startTime;

        if (res.status === 429) {
          logger.info('[Gemini] Rate limit no modelo', { model, status: 429 });
          if (i === lastModel) return { ok: false, reason: 'rate_limit', status: 429, retryable: true };
          continue;
        }
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          logger.info('[Gemini] Modelo falhou', { model, status: res.status });
          if (i === lastModel) return { ok: false, reason: String(res.status), status: res.status, apiMessage: errBody.substring(0, 200), retryable: this.isRetryableError(res.status, errBody) };
          continue;
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text.trim()) {
          logger.info('[Gemini] Resposta vazia', { model });
          if (i === lastModel) return { ok: false, reason: 'empty', status: 200 };
          continue;
        }
        const tokens = (data.usageMetadata?.totalTokens) || 0;
        return { ok: true, text, tokens, ms, model };
      } catch (error) {
        clearTimeout(id);
        const ms = Date.now() - startTime;
        const reason = String(error.code || error.name || 'unknown').toLowerCase();
        logger.info('[Gemini] Erro', { model, error: error.message, reason });
        if (i === lastModel) return { ok: false, reason, status: 0, retryable: true };
      }
    }
    return { ok: false, reason: 'all_models_failed', status: 0 };
  }
}

module.exports = GeminiProvider;