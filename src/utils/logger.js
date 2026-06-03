const config = require('../config/config');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS[config.LOG_LEVEL] || LOG_LEVELS.info;
  }

  log(level, message, data = {}) {
    if (LOG_LEVELS[level] > this.level) return;

    const timestamp = new Date().toISOString();
    const color = this.getColor(level);
    const prefix = `${color}[${timestamp}] [${level.toUpperCase()}]${COLORS.reset}`;
    
    if (Object.keys(data).length === 0) {
      console.log(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`, data);
    }
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  info(message, data = {}) {
    this.log('info', message, data);
  }

  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  getColor(level) {
    switch(level) {
      case 'error': return COLORS.red;
      case 'warn': return COLORS.yellow;
      case 'info': return COLORS.blue;
      case 'debug': return COLORS.gray;
      default: return COLORS.reset;
    }
  }
}

module.exports = new Logger();
