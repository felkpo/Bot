const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'royal_prussian_memory.db');

let db;

/**
 * Inicializa a conexão com o banco de dados SQLite,
 * cria o diretório e o arquivo se não existirem,
 * e garante que o schema das tabelas esteja atualizado.
 */
async function initialize() {
  try {
    // Garante que o diretório de dados exista
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logger.info(`[DB] Diretório de dados criado em: ${DB_DIR}`);
    }

    // Abre o banco de dados
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    logger.info(`[DB] Conexão com SQLite estabelecida: ${DB_PATH}`);

    // Executa a criação de tabelas (não falha se já existirem)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        username TEXT,
        first_seen INTEGER,
        last_seen INTEGER,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS channels (
        channel_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        name TEXT,
        last_messages TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT,
        type TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        source TEXT,
        relevance INTEGER DEFAULT 1,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        event_type TEXT,
        title TEXT,
        description TEXT,
        metadata TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        action TEXT,
        actor_id TEXT,
        actor_tag TEXT,
        target_id TEXT,
        target_tag TEXT,
        reason TEXT,
        channel_id TEXT,
        metadata TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT,
        summary_type TEXT NOT NULL,
        content TEXT,
        updated_at INTEGER
      );
    `);

    logger.info('[DB] Schema do banco de dados verificado e pronto.');
  } catch (err) {
    logger.error('[DB] Falha fatal ao inicializar o banco de dados SQLite.', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Inicializa na primeira importação para garantir que 'db' esteja pronto.
initialize();

module.exports = {
  get: (...args) => db.get(...args),
  all: (...args) => db.all(...args),
  run: (...args) => db.run(...args),
};