const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../utils/logger');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'royal_prussian_memory.db');

function ensureDatabasePath() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

class SqliteDatabase {
  constructor() {
    ensureDatabasePath();
    this.db = new sqlite3.Database(DB_PATH, err => {
      if (err) {
        logger.error('❌ Falha ao abrir o banco de dados SQLite', { error: err.message });
        throw err;
      }
    });

    this.initializeSchema();
  }

  initializeSchema() {
    const schema = `
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        username TEXT,
        first_seen INTEGER,
        last_seen INTEGER,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT,
        relevance INTEGER DEFAULT 1,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS channels (
        channel_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        name TEXT,
        last_messages TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT,
        summary_type TEXT NOT NULL,
        content TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT,
        description TEXT,
        metadata TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        actor_tag TEXT,
        target_id TEXT,
        target_tag TEXT,
        reason TEXT,
        channel_id TEXT,
        metadata TEXT,
        created_at INTEGER
      );
    `;

    this.db.exec(schema, err => {
      if (err) {
        logger.error('❌ Falha ao inicializar schema SQLite', { error: err.message });
      }
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

const sqlite = new SqliteDatabase();
module.exports = sqlite;
