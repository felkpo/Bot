const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config/config');

class OllamaClient {
  constructor() {
    this.url = process.env.OLLAMA_URL || config.OLLAMA_URL || null;
    this.modelName = process.env.OLLAMA_MODEL || config.OLLAMA_MODEL || 'qwen3:8b';
    this.initialized = this.initialize();
  }

  async initialize() {
    if (!this.url) {
      logger.warn('⚠️ OLLAMA_URL não configurada. Ollama desativado.');
      return;
    }

    try {
      logger.info('[Ollama] Conectando ao Ollama...', { url: this.url });
      const ok = await this.healthCheck();
      if (ok) {
        logger.info('[Ollama] Ollama online', { url: this.url, model: this.modelName });
      }
    } catch (error) {
      logger.error('[Ollama] Falha ao inicializar Ollama', { error: error.message });
    }
  }

  async ensureInitialized() {
    return this.initialized;
  }

  async healthCheck(timeoutMs = 8000) {
    if (!this.url) return false;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.url.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.modelName, prompt: 'Olá', max_tokens: 16 })
      });
      clearTimeout(id);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.warn('[Ollama] Health check retornou não ok', { status: res.status, body });
        return false;
      }
      return true;
    } catch (error) {
      clearTimeout(id);
      logger.error('[Ollama] Health check falhou', { error: error.message });
      return false;
    }
  }

  buildSystemPrompt() {
    return `Você é ${config.BOT_NAME}, uma assistente virtual profissional e amigável do servidor Discord.\n
Características:\n- Nome: ${config.BOT_NAME}\n- Você é amigável, educada, inteligente e descontraída\n- Responde sempre em português\n- Usa emojis quando apropriado\n- Ajuda usuários e staff do servidor\n- Nunca diz que é ChatGPT, Gemini ou outra IA externa\n\n+Use as memórias do usuário, canal e servidor quando disponíveis. Ao gerar ações administrativas, retorne somente JSON conforme o protocolo do bot.`;
  }

  async generateResponse(message, promptContext = {}, timeoutMs = 30000) {
    await this.ensureInitialized();

    if (!this.url) {
      throw new Error('Ollama não configurado (OLLAMA_URL ausente)');
    }

    // Build prompt combining system, memories and conversation
    let promptParts = [this.buildSystemPrompt()];

    if (promptContext.userMemory) promptParts.push(`Memória do usuário: ${promptContext.userMemory}`);
    if (promptContext.channelMemory) promptParts.push(`Memória do canal: ${promptContext.channelMemory}`);
    if (promptContext.serverMemory) promptParts.push(`Resumo do servidor: ${promptContext.serverMemory}`);

    if (Array.isArray(promptContext.history) && promptContext.history.length) {
      const hist = promptContext.history.map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.content}`).join('\n');
      promptParts.push(`Histórico recente:\n${hist}`);
    }

    promptParts.push(`Usuário: ${message}`);
    const promptText = promptParts.join('\n\n');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const payload = {
      model: this.modelName,
      prompt: promptText,
      max_tokens: 1024,
      temperature: 0.2
    };

    const start = Date.now();
    try {
      const res = await fetch(`${this.url.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      clearTimeout(id);
      const ms = Date.now() - start;
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error('[Ollama] Erro de geração', { status: res.status, body });
        throw new Error(`Falha ao gerar resposta (status ${res.status})`);
      }

      const data = await res.json();
      // Ollama responses may differ; try to extract text
      let text = '';
      if (typeof data === 'string') text = data;
      else if (data?.output) text = Array.isArray(data.output) ? data.output.map(o => o.content || o.text || '').join('\n') : (data.output?.content || data.output?.text || '');
      else if (data?.results) text = data.results.map(r => r.output?.text || r.output?.content || '').join('\n');
      else text = JSON.stringify(data);

      logger.info('[Ollama] Resposta gerada', { model: this.modelName, responseTimeMs: ms, responseLength: text.length, url: this.url });
      return text;
    } catch (error) {
      clearTimeout(id);
      logger.error('[Ollama] Falha ao gerar resposta', { error: error.message });
      throw error;
    }
  }
}

module.exports = new OllamaClient();
