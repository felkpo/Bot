const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config/config');

class OllamaClient {
  constructor() {
    this.url = (process.env.OLLAMA_URL || config.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
    this.modelName = process.env.OLLAMA_MODEL || config.OLLAMA_MODEL || 'qwen3.6:latest';
    this.initialized = this.initialize();
    this.isOnline = false;
  }

  async initialize() {
    try {
      logger.info('[Ollama] Conectando ao Ollama...', { url: this.url, model: this.modelName });
      
      // Check if model exists
      const modelExists = await this.verifyModel();
      if (!modelExists) {
        logger.warn('⚠️ Modelo não encontrado', { model: this.modelName });
        return;
      }

      // Health check
      const ok = await this.healthCheck();
      if (ok) {
        this.isOnline = true;
        logger.info('✅ Ollama online', { url: this.url, model: this.modelName });
      }
    } catch (error) {
      logger.error('[Ollama] Falha ao inicializar', { error: error.message });
    }
  }

  async ensureInitialized() {
    return this.initialized;
  }

  async verifyModel(timeoutMs = 5000) {
    if (!this.url) return false;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.url}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      clearTimeout(id);
      if (!res.ok) return false;
      
      const data = await res.json();
      const models = data.models || [];
      const found = models.some(m => m.name === this.modelName || m.name.startsWith(this.modelName.split(':')[0]));
      
      if (!found) {
        logger.warn('⚠️ Modelo não encontrado. Modelos disponíveis:', { models: models.map(m => m.name), expected: this.modelName });
      }
      return found;
    } catch (error) {
      clearTimeout(id);
      logger.warn('[Ollama] Falha ao verificar modelo', { error: error.message });
      return false;
    }
  }

  async healthCheck(timeoutMs = 5000) {
    if (!this.url) return false;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.url}/api/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.modelName, prompt: 'ok', stream: false })
      });
      clearTimeout(id);
      if (!res.ok) {
        logger.warn('[Ollama] Health check retornou não ok', { status: res.status });
        return false;
      }
      return true;
    } catch (error) {
      clearTimeout(id);
      logger.debug('[Ollama] Health check falhou', { error: error.message });
      return false;
    }
  }

  buildSystemPrompt() {
    return `Você é ${config.BOT_NAME}, uma assistente virtual profissional e amigável do servidor Discord.\n
Características:\n- Nome: ${config.BOT_NAME}\n- Você é amigável, educada, inteligente e descontraída\n- Responde sempre em português\n- Usa emojis quando apropriado\n- Ajuda usuários e staff do servidor\n- Nunca diz que é ChatGPT, Gemini ou outra IA externa\n\n+Use as memórias do usuário, canal e servidor quando disponíveis. Ao gerar ações administrativas, retorne somente JSON conforme o protocolo do bot.`;
  }

  async generateResponse(message, promptContext = {}, timeoutMs = 30000) {
    await this.ensureInitialized();

    if (!this.isOnline) {
      throw new Error('Ollama está offline. Verifique: http://localhost:11434');
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
      stream: false
    };

    const start = Date.now();
    try {
      const res = await fetch(`${this.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      clearTimeout(id);
      const ms = Date.now() - start;
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error('[Ollama] Erro ao gerar', { status: res.status, body });
        throw new Error(`Ollama retornou status ${res.status}`);
      }

      const data = await res.json();
      let text = data.response || '';

      logger.info('[Ollama] Resposta gerada', { 
        model: this.modelName, 
        responseTimeMs: ms, 
        responseLength: text.length,
        contextLength: promptText.length
      });
      return text;
    } catch (error) {
      clearTimeout(id);
      logger.error('[Ollama] Falha ao gerar resposta', { error: error.message, url: this.url });
      throw error;
    }
  }
}

module.exports = new OllamaClient();
