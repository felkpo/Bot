/**
 * ACTION STATS MANAGER
 *
 * Gerencia as estatísticas de uso das actions, como execuções, falhas e
 * parâmetros ausentes. Persiste os dados em `data/action-stats.json`.
 *
 * @file src/managers/actionStatsManager.js
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const STATS_FILE = path.join(__dirname, '..', '..', 'data', 'action-stats.json');
const STATS_SAVE_DEBOUNCE_MS = 30000;

const statsState = {
  missingParameters: {},
  actionExecutions: {},
  actionFailures: {},
  lastReset: null,
  lastUpdate: null
};

let saveTimer = null;

function persistStats() {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(statsState, null, 2), 'utf8');
    logger.info('[STATS PERSIST] Estatísticas de actions salvas em disco', { file: STATS_FILE });
  } catch (error) {
    logger.error('[STATS PERSIST ERROR] Falha ao salvar estatísticas de actions', { error: error.message });
  }
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistStats, STATS_SAVE_DEBOUNCE_MS);
}

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      logger.info('[STATS LOAD] Arquivo de estatísticas de actions não existe, começando do zero.');
      return;
    }
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    Object.assign(statsState, parsed);
    logger.info('[STATS LOAD] Estatísticas de actions carregadas do disco.');
  } catch (error) {
    logger.error('[STATS LOAD ERROR] Falha ao carregar estatísticas de actions', { error: error.message });
  }
}

function recordMissingParam(action, field) {
  if (!statsState.missingParameters[action]) statsState.missingParameters[action] = {};
  statsState.missingParameters[action][field] = (statsState.missingParameters[action][field] || 0) + 1;
  statsState.lastUpdate = new Date().toISOString();
  schedulePersist();
}

function recordExecution(action) {
  statsState.actionExecutions[action] = (statsState.actionExecutions[action] || 0) + 1;
  statsState.lastUpdate = new Date().toISOString();
  schedulePersist();
}

function recordFailure(action) {
  statsState.actionFailures[action] = (statsState.actionFailures[action] || 0) + 1;
  statsState.lastUpdate = new Date().toISOString();
  schedulePersist();
}

function getActionMetrics() {
  return JSON.parse(JSON.stringify(statsState));
}

function resetActionStats() {
  statsState.missingParameters = {};
  statsState.actionExecutions = {};
  statsState.actionFailures = {};
  statsState.lastReset = new Date().toISOString();
  statsState.lastUpdate = new Date().toISOString();
  if (saveTimer) clearTimeout(saveTimer);
  persistStats();
}

loadStats();

module.exports = {
  recordMissingParam,
  recordExecution,
  recordFailure,
  getActionMetrics,
  resetActionStats,
};