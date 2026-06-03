const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const logger = require('../utils/logger');

class GeminiAI {
  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }
    
    this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = this.client.getGenerativeModel({ 
      model: config.GEMINI_MODEL
    });
    
    logger.info('🤖 IA Gemini inicializada', { model: config.GEMINI_MODEL });
  }

  /**
   * Gera uma resposta usando Gemini
   * @param {string} message - Mensagem do usuário
   * @param {Array} conversationHistory - Histórico da conversa
   * @returns {Promise<string>} - Resposta gerada
   */
  async generateResponse(message, conversationHistory = []) {
    try {
      const systemPrompt = this.getSystemPrompt();
      
      // Prepara o histórico para a API
      const history = conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      // Inicia a conversa
      const chat = this.model.startChat({ history });
      
      const response = await chat.sendMessage(message);
      const text = response.response.text();
      
      logger.debug('💬 Resposta de IA gerada', { 
        messageLength: message.length, 
        responseLength: text.length 
      });
      
      return text;
    } catch (error) {
      logger.error('❌ Erro ao gerar resposta de IA', { 
        error: error.message,
        errorCode: error.code 
      });
      
      // Tratamento específico de erros
      if (error.message?.includes('API key')) {
        throw new Error('Chave de API Gemini inválida');
      }
      if (error.message?.includes('quota')) {
        throw new Error('Limite de requisições da API Gemini excedido');
      }
      if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
        throw new Error('Timeout ao conectar à API Gemini');
      }
      
      throw error;
    }
  }

  /**
   * Obtém o prompt do sistema para a IA
   * @returns {string} - Prompt do sistema
   */
  getSystemPrompt() {
    return `Você é ${config.BOT_NAME}, uma assistente virtual inteligente e amigável do servidor Discord.

Características:
- Nome: ${config.BOT_NAME}
- Você é amigável, educada, inteligente e descontraída
- Responde sempre em português
- Usa emojis ocasionalmente para tornar as mensagens mais amigáveis
- Ajuda usuários e staff do servidor
- Nunca diz que é ChatGPT ou outra IA
- Se apresenta como ${config.BOT_NAME} quando perguntado

Instruções:
- Seja conciso e direto nas respostas (máximo 2000 caracteres)
- Se não souber algo, seja honesto e diga que não tem essa informação
- Mantenha o tom amigável e profissional
- Ajude com dúvidas do servidor, tecnologia, moderation, etc.
- Se alguém pedir para fazer algo inadequado, recuse educadamente`;
  }

  /**
   * Verifica se a API está funcionando
   * @returns {Promise<boolean>} - Se a conexão está ok
   */
  async healthCheck() {
    try {
      await this.generateResponse('Olá, tudo bem?', []);
      return true;
    } catch (error) {
      logger.error('❌ Health check da IA falhou', { error: error.message });
      return false;
    }
  }
}

module.exports = new GeminiAI();
