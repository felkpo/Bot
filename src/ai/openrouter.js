const fetch = global.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config/config');
const { getCatalogText } = require('../config/commandCatalog');

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
    this.url = config.providers.openrouter.url || 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = config.providers.openrouter.apiKey;
    this.modelName = config.providers.openrouter.model;
    this.isAvailable = false;
    this.modelInfo = null;
    this.initialized = this.initialize();
    this._modelsCache = { timestamp: 0, success: false, models: [] };
  }

  async initialize() {
    if (!this.apiKey) { this.isOnline = false; return; }
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
        return this._buildAkiraPersonality();
      case 'servant':
        return this._buildServantPersonality();
      case 'tester':
      case 'admintester':
        return this._buildTesterPersonality();
      default:
        return this._buildAkiraPersonality(); // Akira é o padrão
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
        const rawText = data.choices?.[0]?.message?.content || '';
  
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