require('dotenv').config();

module.exports = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  
  // Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: 'gemini-1.5-flash',
  
  // AI Settings
  AI: {
    maxHistoryPerUser: 10,
    messageTimeout: 30000,
    cooldownMs: 2000,
    prefixes: ['Prussia', 'prussia', 'royal prussian', 'Royal Prussian', 'RP', 'rp', 'Rp', 'rP'],
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
  }
};
