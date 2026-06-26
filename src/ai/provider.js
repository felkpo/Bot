// Seletor de provider de IA — Sistema Multi-Provedor com Fallback
//
// Ordem de prioridade:
// 1. Gemini (primário)
// 2. Groq (primeiro fallback)
// 3. Cloudflare Workers AI (segundo fallback)
// 4. OpenRouter (último recurso)
//
// Cada provedor tem seu próprio pool de modelos com fallback interno.
// Se um provedor inteiro falhar (rate limit, quota, 5xx, timeout),
// o sistema troca automaticamente para o próximo provedor.

const logger = require('../utils/logger');
const config = require('../config/config');

// Aviso se alguém tentar usar AI_PROVIDER=ollama
if (config.AI_PROVIDER && String(config.AI_PROVIDER).toLowerCase() === 'ollama') {
  logger.warn('⚠️ AI_PROVIDER=ollama foi IGNORADO. Ollama foi removido. Usando sistema multi-provedor.');
}

logger.info('🧠 Provider de IA: Sistema Multi-Provedor (Gemini → Groq → WorkersAI → OpenRouter)');
const selected = require('./multi-provider');

module.exports = selected;