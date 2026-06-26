// NOTA: Não chamar dotenv.config() aqui se já foi chamado no arquivo principal
// O index.js já carrega o dotenv antes de importar este arquivo

module.exports = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  
  // Seletor de provider de IA: 'openrouter' (padrão) ou 'ollama'
  AI_PROVIDER: (process.env.AI_PROVIDER || 'openrouter').toLowerCase(),

  // AI Settings
  AI: {
    maxHistoryPerUser: 10,
    messageTimeout: 30000,
    cooldownMs: 2000,
    prefixes: ['RP', 'rp', 'royal prussian', 'prussia', 'mprussia'],
  },

  // Configuração centralizada dos provedores de IA
  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
    },
    workersai: {
      apiKey: process.env.CF_WORKERS_AI_API_KEY,
      accountId: process.env.CF_WORKERS_AI_ACCOUNT_ID,
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
      url: 'https://openrouter.ai/api/v1/chat/completions',
    },
    ollama: { // DEPRECATED (mantido para compatibilidade estrutural)
      url: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    }
  },
  
  // Bot Name
  BOT_NAME: 'Royal Prussian',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Features
  FEATURES: {
    AI_ENABLED: true,
    ADMIN_COMMANDS_ENABLED: true,
    COOLDOWN_ENABLED: true,
    BOT_IGNORE_ENABLED: true,
  },

  // Teste de isolamento: usa message.channel.send() em vez de message.reply()
  // Defina USE_CHANNEL_SEND=true no .env para ativar
  USE_CHANNEL_SEND: process.env.USE_CHANNEL_SEND === 'true'
};
