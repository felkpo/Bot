const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config/config');

class OllamaClient {
  constructor() {
    this.url = (process.env.OLLAMA_URL || config.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
    // PRIORIDADE MÁXIMA: process.env.OLLAMA_MODEL (do .env) sempre tem precedência
    this.modelName = process.env.OLLAMA_MODEL || config.OLLAMA_MODEL || 'qwen2.5:7b';
    this.enableThinking = process.env.ENABLE_THINKING !== 'false'; // Padrão: true (comportamento atual)
    this.modelInfo = null;
    this.initialized = this.initialize();
    this.isOnline = false;
  }

  async initialize() {
    try {
      // Log de startup exibindo o modelo carregado (prioridade do .env)
      logger.info(`📋 Modelo carregado: ${this.modelName}`);
      logger.info('[Ollama] Iniciando conexão...', { url: this.url, model: this.modelName });

      // Verifica se o modelo existe via /api/tags ANTES de iniciar
      const modelExists = await this.validateModel();
      if (!modelExists) {
        // Erro amigável já exibido em validateModel() junto com a lista de modelos disponíveis
        this.isOnline = false;
        return;
      }

      // Health check usando /api/tags (GET) - mais leve e confiável
      const ok = await this.healthCheck();
      if (ok) {
        this.isOnline = true;
        logger.info('✅ Ollama online', { url: this.url, model: this.modelName });
      } else {
        logger.error('[Ollama] Health check falhou - Ollama considerado offline');
      }
    } catch (error) {
      logger.error('[Ollama] Falha ao inicializar', { error: error.message });
    }
  }

  async ensureInitialized() {
    return this.initialized;
  }

  /**
   * Confirma através do endpoint /api/tags que o modelo configurado existe.
   * Caso não exista, mostra erro amigável e lista os modelos disponíveis.
   * @returns {Promise<boolean>} true se o modelo existe, false caso contrário
   */
  async validateModel(timeoutMs = 5000) {
    if (!this.url) {
      logger.error('❌ URL do Ollama não configurada. Verifique OLLAMA_URL no .env');
      return false;
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.url}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      clearTimeout(id);

      if (!res.ok) {
        logger.error('❌ Não foi possível consultar os modelos do Ollama', { status: res.status });
        return false;
      }

      const data = await res.json();
      const models = data.models || [];
      const availableNames = models.map(m => m.name);

      // Verifica se o modelo exato existe (ou variação base do mesmo nome)
      const exists = models.some(
        m => m.name === this.modelName || m.name.startsWith(this.modelName.split(':')[0])
      );

      if (!exists) {
        logger.error('═══════════════════════════════════════════════════════');
        logger.error(`❌ MODELO NÃO ENCONTRADO: "${this.modelName}"`);
        logger.error('O modelo configurado no .env não está instalado no Ollama.');
        logger.error('📦 Modelos disponíveis no momento:');
        if (availableNames.length > 0) {
          availableNames.forEach(name => logger.error(`   • ${name}`));
        } else {
          logger.error('   (nenhum modelo instalado)');
        }
        logger.error(`💡 Para instalar o modelo, execute: ollama pull ${this.modelName}`);
        logger.error('═══════════════════════════════════════════════════════');
        return false;
      }

      logger.info(`✅ Modelo "${this.modelName}" confirmado no Ollama`);
      return true;
    } catch (error) {
      clearTimeout(id);
      logger.error('❌ Falha ao validar modelo do Ollama', {
        error: error.message,
        code: error.code,
        url: this.url
      });
      return false;
    }
  }

  async healthCheck(timeoutMs = 5000) {
    logger.info('[INFO] URL utilizada:', { url: this.url });
    logger.info('[INFO] Endpoint utilizado:', { endpoint: '/api/tags', method: 'GET' });
    
    if (!this.url) {
      logger.error('[ERROR] URL do Ollama não configurada');
      return false;
    }
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const res = await fetch(`${this.url}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      clearTimeout(id);
      
      logger.info('[INFO] Status HTTP recebido:', { status: res.status, statusText: res.statusText });
      
      if (!res.ok) {
        logger.error('[ERROR] Health check retornou status não sucesso', { status: res.status });
        return false;
      }
      
      const data = await res.json();
      const models = data.models || [];
      const modelInfo = models.find(m => m.name === this.modelName || m.name.startsWith(this.modelName.split(':')[0]));
      const modelFound = !!modelInfo;
      
      if (modelFound) {
        // Extrair informações detalhadas do modelo
        const modelDetails = modelInfo.details || {};
        const modelSize = modelInfo.size || 0;
        const modelDigest = modelInfo.digest || 'N/A';
        const format = modelDetails.format || 'N/A';
        const family = modelDetails.family || 'N/A';
        const parameterSize = modelDetails.parameter_size || 'N/A';
        const quantization = modelDetails.quantization_level || 'N/A';
        
        logger.info('[INFO] Modelo encontrado:', { model: this.modelName });
        logger.info('📋 INFORMAÇÕES DO MODELO:', {
          nome: this.modelName,
          familia: family,
          tamanho: this.formatSize(modelSize),
          tamanhoBytes: modelSize,
          formato: format,
          parametros: parameterSize,
          quantizacao: quantization,
          digest: modelDigest.substring(0, 16) + '...'
        });
        
        // Armazenar informações do modelo
        this.modelInfo = {
          name: this.modelName,
          family: family,
          size: modelSize,
          sizeFormatted: this.formatSize(modelSize),
          format: format,
          parameters: parameterSize,
          quantization: quantization,
          digest: modelDigest
        };
        
        // Recomendações baseadas no tamanho
        if (modelSize > 10e9) {
          logger.info('💡 RECOMENDAÇÃO: Modelo grande detectado (>10GB)', {
            sugestao: 'Considere usar um modelo menor para respostas mais rápidas',
            opcoes: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b', 'mistral:7b'],
            velocidadeEsperada: '10-30 segundos por resposta'
          });
        } else if (modelSize > 5e9) {
          logger.info('💡 RECOMENDAÇÃO: Modelo médio detectado (5-10GB)', {
            velocidadeEsperada: '5-15 segundos por resposta'
          });
        } else {
          logger.info('💡 RECOMENDAÇÃO: Modelo leve detectado (<5GB)', {
            velocidadeEsperada: '2-8 segundos por resposta'
          });
        }
      } else {
        logger.warn('[ERROR] Modelo não encontrado:', { 
          expected: this.modelName, 
          available: models.map(m => m.name) 
        });
      }
      
      return true;
    } catch (error) {
      clearTimeout(id);
      logger.error('[ERROR] Motivo exato da falha:', { 
        error: error.message, 
        code: error.code,
        url: this.url
      });
      return false;
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  getModelInfo() {
    return this.modelInfo || null;
  }

  _buildConversationPrompt() {
    return `Você é ${config.BOT_NAME}, um assistente útil e cordial em um servidor Discord. ` +
      `Responda de forma clara, objetiva e em português do Brasil. ` +
      `` +
      `Quando o usuário pedir para executar uma ação, responda APENAS com um JSON puro. ` +
      `Caso contrário, converse normalmente.`;
  }

  _buildActionPrompt(context = {}) {
    let forcedActionPrompt = '';
    if (context.resolvedActionType) {
      forcedActionPrompt = `\n## AÇÃO PRÉ-DETERMINADA\nA ação já foi determinada pelo sistema.\nVocê DEVE retornar:\n"${context.resolvedActionType}"\nNão utilize nenhuma outra action.\n`;
    }

    return `ACTION MODE - FONTE DE VERDADE DAS ACOES

Voce NAO decide quais acoes existem.
Voce NAO decide quais permissoes possui.
Voce NAO decide o que consegue ou nao consegue fazer.

As acoes abaixo sao IMPLEMENTADAS no sistema. Se uma acao estiver listada, assuma que ela EXISTE e PODE ser executada.

Nunca responda:
- "nao tenho permissao"
- "nao consigo fazer isso"
- "essa acao nao existe"
- "nao tenho acesso"

Sua unica funcao: converter o pedido do usuario para JSON.

## FORMATO OBRIGATORIO

{ "action": "...", "params": {} }

Nunca utilize "message" ou "content" fora de params.
Nunca utilize texto explicativo, markdown ou blocos de codigo.
Retorne SOMENTE JSON.
${forcedActionPrompt}
## ACOES IMPLEMENTADAS

send_message   -> { "action": "send_message", "params": { "channel_id": "...", "content": "..." } }
create_embed   -> { "action": "create_embed", "params": { "channel_id": "...", "title": "...", "description": "..." } }
warn_user      -> { "action": "warn_user", "params": { "target": "...", "reason": "..." } }
send_dm        -> { "action": "send_dm", "params": { "target": "...", "content": "..." } }
purge_messages -> { "action": "purge_messages", "params": { "count": 10 } }  // também aceita "amount" ou "limit"
ban_user       -> { "action": "ban_user", "params": { "target": "...", "reason": "..." } }
unban_user     -> { "action": "unban_user", "params": { "target": "...", "reason": "..." } }
kick_user      -> { "action": "kick_user", "params": { "target": "...", "reason": "..." } }
timeout_user   -> { "action": "timeout_user", "params": { "target": "...", "duration": "..." } }
untimeout_user -> { "action": "untimeout_user", "params": { "target": "...", "reason": "..." } }
mute_user      -> { "action": "timeout_user", "params": { "target": "...", "duration": "..." } }
unmute_user    -> { "action": "untimeout_user", "params": { "target": "...", "reason": "..." } }
add_role       -> { "action": "add_role", "params": { "target": "...", "role_id": "..." } }
remove_role    -> { "action": "remove_role", "params": { "target": "...", "role_id": "..." } }
create_channel -> { "action": "create_channel", "params": { "name": "..." } }
delete_channel -> { "action": "delete_channel", "params": { "channel_id": "..." } }`;
  }

  buildSystemPrompt(context = {}) {
    return this._buildConversationPrompt();
  }

  async generateResponse(userMessage, context = {}, timeoutMs = config.AI?.messageTimeout || 30000) {
    await this.ensureInitialized();

    // Detecta modo: ação vs conversa (agora centralizado no messageCreate.js)
    const isAction = context.isActionMode === true;
    const mode = isAction ? 'action' : 'conversation';
    logger.info('[PROMPT MODE]', { mode, arquivo: 'src/ai/ollama.js' });

    let promptParts;

    if (isAction) {
      // MODO AÇÃO: prompt isolado, sem personalidade, sem memórias, sem histórico
      promptParts = [this._buildActionPrompt()];
      promptParts.push(`Usuário: ${userMessage}`);
    } else {
      // MODO CONVERSA: personalidade ativa, memórias e contexto
      promptParts = [this._buildConversationPrompt()];
      if (context.userMemory) promptParts.push(`Memória do usuário: ${context.userMemory}`);
      if (context.channelMemory) promptParts.push(`Memória do canal: ${context.channelMemory}`);
      if (context.serverMemory) promptParts.push(`Resumo do servidor: ${context.serverMemory}`);
      if (Array.isArray(context.history) && context.history.length) {
        const hist = context.history
          .map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.content}`)
          .join('\n');
        promptParts.push(`Histórico recente:\n${hist}`);
      }
      promptParts.push(`Usuário: ${userMessage}`);
    }

    const promptText = promptParts.join('\n\n');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      model: this.modelName,
      prompt: promptText,
      stream: false,
      think: this.enableThinking,
      options: {
        // Temperatura para criatividade controlada
        temperature: 0.7,
        // Número máximo de tokens a gerar
        num_predict: 1024,
        // Top-p para amostragem nucleus
        top_p: 0.9,
        // Top-k para diversidade controlada
        top_k: 40,
        // Repetition penalty para evitar repetição
        repeat_penalty: 1.1,
        // Número de ctx para o contexto
        num_ctx: 8192
      }
    };

    logger.info('[Ollama] Payload enviado:', {
      model: this.modelName,
      promptLength: promptText.length,
      enableThinking: this.enableThinking,
      temperature: payload.options.temperature,
      numPredict: payload.options.num_predict,
      numCtx: payload.options.num_ctx
    });

    const startTime = Date.now();
    logger.info('[INFO] Tempo de início:', { timestamp: new Date(startTime).toISOString() });

    try {
      const res = await fetch(`${this.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      clearTimeout(id);
      const endTime = Date.now();
      const ms = endTime - startTime;

      logger.info('[INFO] Tempo total de geração:', { ms: ms, seconds: (ms / 1000).toFixed(2) });

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
        responseTimeSeconds: (ms / 1000).toFixed(2),
        responseLength: text.length,
        contextLength: promptText.length
      });
      return text;
    } catch (error) {
      clearTimeout(id);
      const endTime = Date.now();
      const ms = endTime - startTime;

      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        logger.error('[ERROR] Requisição abortada - timeout excedido', {
          error: error.message,
          timeoutMs: timeoutMs,
          timeoutSeconds: timeoutMs / 1000,
          tempoDecorridoMs: ms,
          tempoDecorridoSeconds: (ms / 1000).toFixed(2),
          motivo: 'A operação foi cancelada porque o timeout foi atingido antes da resposta completa do Ollama'
        });
      } else {
        logger.error('[Ollama] Falha ao gerar resposta', { 
          error: error.message,
          errorCode: error.code,
          errorName: error.name,
          url: this.url,
          tempoDecorridoMs: ms
        });
      }
      throw error;
    }
  }
}

module.exports = new OllamaClient();