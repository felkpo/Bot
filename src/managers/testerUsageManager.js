const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const USAGE_FILE = path.join(__dirname, '..', '..', 'data', 'tester-usage.json');
const MAX_TESTER_USES_PER_DAY = 10;

class TesterUsageManager {
  constructor() {
    this.usageData = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const raw = fs.readFileSync(USAGE_FILE, 'utf8');
        this.usageData = JSON.parse(raw);
      }
    } catch (error) {
      logger.error('[TESTER USAGE] Erro ao carregar dados', { error: error.message });
      this.usageData = {};
    }
  }

  save() {
    try {
      const dir = path.dirname(USAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.usageData, null, 2), 'utf8');
    } catch (error) {
      logger.error('[TESTER USAGE] Erro ao salvar dados', { error: error.message });
    }
  }

  getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  getUsage(userId) {
    const today = this.getTodayKey();
    if (!this.usageData[today]) {
      this.usageData[today] = {};
    }
    return this.usageData[today][userId] || 0;
  }

  incrementUsage(userId) {
    const today = this.getTodayKey();
    if (!this.usageData[today]) {
      this.usageData[today] = {};
    }
    const previous = this.usageData[today][userId] || 0;
    const current = previous + 1;
    this.usageData[today][userId] = current;
    this.save();
    
    logger.info('[TESTER USAGE INCREMENT]', {
      userId,
      previous,
      current
    });
    
    return current;
  }

  canUse(userId) {
    const usage = this.getUsage(userId);
    const remaining = this.getRemaining(userId);
    
    logger.info('[TESTER LIMIT CHECK]', {
      userId,
      usage,
      remaining,
      max: MAX_TESTER_USES_PER_DAY
    });
    
    const allowed = usage < MAX_TESTER_USES_PER_DAY;
    if (!allowed) {
      logger.info('[TESTER LIMIT EXCEEDED]', {
        userId,
        usage,
        max: MAX_TESTER_USES_PER_DAY
      });
    }
    return allowed;
  }

  getRemaining(userId) {
    const usage = this.getUsage(userId);
    return Math.max(0, MAX_TESTER_USES_PER_DAY - usage);
  }

  resetUser(userId) {
    const today = this.getTodayKey();
    if (!this.usageData[today]) {
      this.usageData[today] = {};
    }
    this.usageData[today][userId] = 0;
    this.save();
  }

  addUsage(userId, amount, adminId) {
    const today = this.getTodayKey();
    if (!this.usageData[today]) {
      this.usageData[today] = {};
    }
    const previous = this.usageData[today][userId] || 0;
    const current = previous + amount;
    this.usageData[today][userId] = current;
    this.save();
    
    logger.info('[TESTER ADD USAGE]', {
      admin: adminId,
      target: userId,
      before: previous,
      after: current
    });
    
    return current;
  }

  removeUsage(userId, amount, adminId) {
    const today = this.getTodayKey();
    if (!this.usageData[today]) {
      this.usageData[today] = {};
    }
    const previous = this.usageData[today][userId] || 0;
    const current = Math.max(0, previous - amount);
    this.usageData[today][userId] = current;
    this.save();
    
    logger.info('[TESTER REMOVE USAGE]', {
      admin: adminId,
      target: userId,
      before: previous,
      after: current
    });
    
    return current;
  }

  setUsage(userId, amount, adminId) {
    const today = this.getTodayKey();
    if (!this.usageData[today]) {
      this.usageData[today] = {};
    }
    const previous = this.usageData[today][userId] || 0;
    const current = Math.max(0, amount);
    this.usageData[today][userId] = current;
    this.save();
    
    logger.info('[TESTER SET USAGE]', {
      admin: adminId,
      target: userId,
      before: previous,
      after: current
    });
    
    return current;
  }
}

module.exports = new TesterUsageManager();
