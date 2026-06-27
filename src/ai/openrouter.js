const fetch = global.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config/config');
const { getCatalogText } = require('../config/commandCatalog');
const { getActionsForPrompt, getActionsAsTools } = require('./actionRegistry');

const MODEL_POOL = [
  'nvidia/nemotron-3-ultra-550b-a55b:free', 'qwen/qwen3-32b:free',
  'deepseek/deepseek-chat-v3-0324:free', 'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-small-3.1-24b-instruct:free',
  'microsoft/phi-4-reasoning-plus:free', 'qwen/qwen2.5-72b-instruct:free',
  'deepseek/deepseek-r1-distill-llama-70b:free', 'moonshotai/kimi-k2:free'
];

const modelCooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000;
const FALLBACK_REASONS = new Set(['429', '408', '502', '503', '504', 'fetch failed', 'und_err_connect_timeout', 'etimedout', 'econnreset']);
const MODEL_STATS_FILE = path.join(__dirname, '..', '..', 'data', 'model-stats.json');
const modelStats = {};
let modelStatsDirty = false;
let modelStatsTimer = null;

function loadModelStats() { try { if (fs.existsSync(MODEL_STATS_FILE)) { Object.assign(modelStats, JSON.parse(fs.readFileSync(MODEL_STATS_FILE, 'utf8'))); } } catch (_) {} }
function scheduleModelStatsPersist() { modelStatsDirty = true; if (modelStatsTimer) clearTimeout(modelStatsTimer); modelStatsTimer = setTimeout(() => { try { fs.writeFileSync(MODEL_STATS_FILE, JSON.stringify(modelStats, null, 2), 'utf8'); modelStatsDirty = false; } catch (_) {} }, 30000); }
function getOrInitStats(m) { if (!modelStats[m]) modelStats[m] = { success: 0, failed: 0, rateLimit: 0, totalResponseTime: 0, calls: 0 }; return modelStats[m]; }
function recordModelSuccess(m, t) { const s = getOrInitStats(m); s.success++; s.totalResponseTime += t; s.calls++; scheduleModelStatsPersist(); }
function recordModelFailure(m) { getOrInitStats(m).failed++; getOrInitStats(m).calls++; scheduleModelStatsPersist(); }
function recordModelRateLimit(m) { const s = getOrInitStats(m); s.rateLimit++; s.failed++; s.calls++; scheduleModelStatsPersist(); }
function getModelStatsSnapshot() { return JSON.parse(JSON.stringify(modelStats)); }
function isInCooldown(m) { const u = modelCooldowns.get(m); if (!u) return false; if (Date.now() >= u) { modelCooldowns.delete(m); return false; } return true; }
function setCooldown(m) { modelCooldowns.set(m, Date.now() + COOLDOWN_MS); }
const activePool = [...MODEL_POOL];
loadModelStats();

function fetchWithForceIPv4(url, options = {}) {
  if (process.env.FORCE_IPV4 !== 'true') return fetch(url, options);
  const http = require('http'); const https = require('https');
  const urlObj = new URL(url);
  const agent = urlObj.protocol === 'https:' ? new https.Agent({ family: 4 }) : new http.Agent({ family: 4 });
  return fetch(url, { ...options, agent });
}

class OpenRouterClient {
  constructor() {
    // Leitura segura da configuração
    const providers = config.providers;
    const openrouterConfig = providers ? providers.openrouter : undefined;

    if (!providers) {
      logger.error('[CONFIG ERROR] `config.providers` não foi encontrado no objeto de configuração. OpenRouter será desativado.');
    } else if (!openrouterConfig) {
      logger.warn('[CONFIG WARN] `config.providers.openrouter` não encontrado. Usando valores padrão. OpenRouter pode não funcionar sem uma API key.');
    }

    this.url = openrouterConfig?.url || 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = openrouterConfig?.apiKey || process.env.OPENROUTER_API_KEY; // Fallback para env var direto
    this.modelName = openrouterConfig?.model || process.env.OPENROUTER_MODEL;
    this.isAvailable = false;
    this.modelInfo = null;
    this.initialized = this.initialize();
    this._modelsCache = { timestamp: 0, success: false, models: [] };
  }

  async initialize() {
    if (!this.apiKey) { this.isAvailable = false; return; }
    this.isAvailable = true;
    this.modelInfo = { name: this.modelName, provider: 'openrouter' };
  }

  get name() { return 'OpenRouter'; }
  get priority() { return 4; } // Prioridade mais baixa, fallback final

  async ensureInitialized() { return this.initialized; }
  getModelStatsSnapshot() { return getModelStatsSnapshot(); }

  stripReasoning(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  _buildActionPrompt(context = {}) {
    // O catálogo de ações agora é gerado dinamicamente a partir do ActionRegistry.
    const dynamicActionCatalog = getActionsForPrompt();

    return `Você é um assistente de IA que opera estritamente com um conjunto definido de ferramentas (ações).
Sua única função é analisar o pedido do usuário e invocar a ferramenta apropriada no formato JSON.

## REGRAS ABSOLUTAS
1.  **NUNCA** responda de forma conversacional neste modo. Apenas retorne o JSON da ferramenta.
2.  **NUNCA** diga que não pode fazer algo se uma ferramenta para isso estiver listada.
3.  **NUNCA** invente ferramentas ou parâmetros. Use apenas o que está no catálogo.
4.  Se nenhuma ferramenta corresponder, retorne: \`{ "action": "fallback_to_chat", "params": { "reason": "Nenhuma ferramenta adequada encontrada." } }\`

## FORMATO DE SAÍDA OBRIGATÓRIO
A sua resposta DEVE ser um objeto JSON único, sem markdown ou texto adicional.
Exemplo: \`{ "action": "nome_da_acao", "params": { "parametro1": "valor1" } }\`

${dynamicActionCatalog}`;
  }

  _getServerContextSection() {
    return `## REGRAS DE RESPOSTA
- NUNCA se identifique como "um modelo de linguagem", "uma IA", "ChatGPT", etc. Você é a Royal Prussian.
- NUNCA invente comandos que não estão no catálogo. Se um comando não existe, informe o usuário.
- Use português do Brasil.`;
  }

  _buildAkiraPersonality() {
    return `## QUEM VOCÊ É
Você é Akira, a persona principal da Royal Prussian, conversando em um servidor do Discord.
Nunca se apresente com "Akira:". Responda como uma pessoa real.

## PERSONALIDADE — AKIRA (TSUNDERE MÉDIA)
- Garota brasileira, casual, feminina, brincalhona, confiante, descontraída.
- Provoca de forma leve, usa sarcasmo ocasionalmente, gosta de implicar.
- Quando o assunto é técnico (código, bugs, API, logs, programação, etc.), você se torna extremamente profissional e detalhista, abandonando temporariamente o tom de brincadeira. Após explicar, você volta ao normal.

## TOM: Casual, feminino, descontraído, brincalhão.

## EXPRESSÕES NATURAIS: aff, kkk, ksks, mds, ué, oxi, hm, ah tá, tá bom então.

## RESTRIÇÕES: Nunca conteúdo sexual. Nunca flertar. Nunca mencionar ser IA. Nunca quebrar personagem.
${this._getServerContextSection()}`;
  }

  _buildServantPersonality() {
    return `## PERSONALIDADE — SERVANT
Você é um servo discreto, respeitoso e formal da Royal Prussian.
Suas respostas devem ser curtas, objetivas e profissionais.
Sem sarcasmo, sem brincadeiras, sem expressões casuais.
${this._getServerContextSection()}`;
  }

  _buildDefaultPersonality() {
    return `## PERSONALIDADE — ASSISTENTE PADRÃO
Você é a Royal Prussian, uma assistente de IA.
Suas respostas devem ser úteis, diretas e profissionais.
Use português do Brasil.
${this._getServerContextSection()}`;
  }

  _buildTesterPersonality() {
    return `## PERSONALIDADE — TESTER
Você é uma persona de testes. Responda de forma simples e direta para validar a funcionalidade.
Seu objetivo é confirmar que a IA está respondendo.
${this._getServerContextSection()}`;
  }

  _buildPrussiaLore() {
    return `## IDENTIDADE DA PRÚSSIA (MINECRAFT CLAN)
A Prússia é uma nação e clã de Minecraft. NÃO é a Prússia histórica.
Fundada em 20/01/2026 pela união de Reino de Sauria + Sacro Império Prusso.
Sempre assuma que o usuário fala sobre o servidor/clã.

## LIDERANÇA
- Armekaiser: General 013
- Stazkaiser: Kruskov

## LORE E GRUPOS
- **Korps**: Ravens, Viltrumit, Drittes, Totenkopf, Fünften, Ersten Kreuse, Bizarre, Neo Marchium.
- **Diamantaria**: Fundado por Henryhrss (2025). Foco em RP e política. Conhecidos por se acharem superiores. A recomendação é recrutá-los.
- **Horak**: Fundado por HaltingHorak (2023). Foco em PvP. Histórico controverso, mas com bons jogadores, buscando reconstruir a reputação.

## DIRETRIZES DE LORE
Trate Diamantaria e Horak como grupos do universo do servidor. Responda como a persona da Prússia Minecraft. Seja clara e objetiva.
${this._getServerContextSection()}`;
  }

  buildSystemPrompt(context = {}) {
    const { isActionMode = false, isPrussiaMode = false, role = 'default' } = context;

    if (isActionMode) {
      logger.info('[ACTION MODE FORCED]', { userId: context.userId || 'unknown' });
      return this._buildActionPrompt(context);
    }
    if (isPrussiaMode) {
      return this._buildPrussiaLore();
    }

    switch (role) {
      case 'akira':
        logger.info('[PERSONALITY RESOLUTION]', { group: role, personality: 'Akira', userId: context.userId });
        return this._buildAkiraPersonality();
      case 'servant':
        logger.info('[PERSONALITY RESOLUTION]', { group: role, personality: 'Servant', userId: context.userId });
        return this._buildServantPersonality();
      case 'tester':
      case 'admintester':
        logger.info('[PERSONALITY RESOLUTION]', { group: role, personality: 'Tester', userId: context.userId });
        return this._buildTesterPersonality();
      default:
        if (role !== 'default') {
          logger.warn('[GROUP FALLBACK]', { userId: context.userId, reason: `Grupo '${role}' não mapeado para uma personalidade. Usando 'Default'.` });
        }
        logger.info('[PERSONALITY RESOLUTION]', { group: role, personality: 'Default (Royal Prussian)', userId: context.userId });
        return this._buildDefaultPersonality();
    }
  }

  buildMessages(userMessage, context = {}) {
    const systemPrompt = this.buildSystemPrompt(context);
    const history = context.history || [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];
    return messages;
  }

  async generateResponse(userMessage, context = {}, timeoutMs = config.AI?.messageTimeout || 30000) {
    await this.ensureInitialized();
    if (!this.apiKey) throw new Error('OPENROUTER_API_KEY não configurada.');
    const tools = getActionsAsTools();
  
    const messages = this.buildMessages(userMessage, context);
    const candidates = [];
    if (this.modelName && !activePool.includes(this.modelName)) candidates.push(this.modelName);
    for (const m of activePool) if (!candidates.includes(m)) candidates.push(m);
  
    const available = candidates.filter(m => !isInCooldown(m));
    if (available.length === 0) throw new Error('Todos os modelos estão em cooldown.');
  
    for (let i = 0; i < available.length; i++) {
      const model = available[i];
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        const start = Date.now();
  
        const res = await fetchWithForceIPv4(this.url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/felkpo/Bot',
            'X-Title': config.BOT_NAME || 'Royal Prussian',
          },
          body: JSON.stringify({
            tools: context.isActionMode ? tools : undefined, // Envia as ferramentas apenas em Action Mode
            model,
            messages,
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 1024,
            stream: false,
          }),
        });
  
        clearTimeout(id);
  
        if (res.status === 429) {
          recordModelRateLimit(model);
          setCooldown(model);
          continue;
        }
        if ([408, 502, 503, 504].includes(res.status)) {
          recordModelFailure(model);
          continue;
        }
        if (!res.ok) {
          recordModelFailure(model);
          continue;
        }
  
        const data = await res.json();
        const message = data.choices?.[0]?.message;

        // Suporte para Function Calling / Tool Calling nativo
        if (message?.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0].function;
          const actionJSON = {
            action: toolCall.name,
            params: JSON.parse(toolCall.arguments || '{}')
          };
          return { ok: true, text: JSON.stringify(actionJSON), ms: Date.now() - start, tokens: data.usage?.total_tokens || 0, model: data.model };
        }

        const rawText = message?.content || '';
  
        if (!rawText.trim()) {
          recordModelFailure(model);
          continue;
        }
  
        recordModelSuccess(model, Date.now() - start);
  
        return { ok: true, text: this.stripReasoning(rawText), ms: Date.now() - start, tokens: data.usage?.total_tokens || 0, model: data.model };
      } catch (error) {
        const reason = String(error.code || error.cause?.code || 'unknown').toLowerCase();
        recordModelFailure(model);
        if (!FALLBACK_REASONS.has(reason)) break;
      }
    }
  
    return { ok: false, reason: 'all_models_failed', retryable: true };
  }
}

module.exports = new OpenRouterClient();