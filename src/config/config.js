// NOTA: Não chamar dotenv.config() aqui se já foi chamado no arquivo principal
// O index.js já carrega o dotenv antes de importar este arquivo

module.exports = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  
  // Seletor de provider de IA: 'openrouter' (padrão) ou 'ollama'
  AI_PROVIDER: (process.env.AI_PROVIDER || 'openrouter').toLowerCase(),

  // OpenRouter (provider principal)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  OPENROUTER_URL: 'https://openrouter.ai/api/v1/chat/completions',

  // Ollama (localhost by default) - DEPRECATED (migrado para OpenRouter)
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
  
  // AI Settings
  AI: {
    maxHistoryPerUser: 10,
    messageTimeout: 30000,
    cooldownMs: 2000,
    prefixes: ['RP', 'rp', 'royal prussian', 'prussia', 'mprussia'],
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
