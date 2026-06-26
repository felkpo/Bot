const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'guild-settings.json');

class GuildSettingsManager {
  constructor() {
    this.settings = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        this.settings = JSON.parse(raw);
      }
    } catch (error) {
      logger.error('[GUILD SETTINGS] Erro ao carregar dados', { error: error.message });
      this.settings = {};
    }
  }

  save() {
    try {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      logger.error('[GUILD SETTINGS] Erro ao salvar dados', { error: error.message });
    }
  }

  getGuildConfig(guildId) {
    if (!guildId) return {};
    if (!this.settings[guildId]) {
      this.settings[guildId] = {
        quickPunishment: false // Desativado por padrão
      };
      this.save();
    }
    return this.settings[guildId];
  }

  getQuickPunishment(guildId) {
    const config = this.getGuildConfig(guildId);
    return !!config.quickPunishment;
  }

  setQuickPunishment(guildId, enabled) {
    if (!guildId) return false;
    const config = this.getGuildConfig(guildId);
    config.quickPunishment = !!enabled;
    this.save();
    
    logger.info('[QUICK PUNISHMENT]', {
      enabled: config.quickPunishment,
      guildId
    });
    
    return config.quickPunishment;
  }
}

module.exports = new GuildSettingsManager();
