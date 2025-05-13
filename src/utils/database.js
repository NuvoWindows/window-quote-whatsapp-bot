/**
 * Database utility for Window Quote WhatsApp Bot
 * Handles database initialization and connection management
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('../config/config');

// Database configuration
const dbConfig = {
  DB_PATH: config.db.path,
  INIT_SCHEMA: true, // Whether to initialize schema on startup
};

// Create data directory if it doesn't exist
const dataDir = path.dirname(dbConfig.DB_PATH);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info(`Created data directory: ${dataDir}`);
  } catch (err) {
    logger.error(`Failed to create data directory: ${err.message}`);
    throw err; // Critical error, can't proceed without storage
  }
}

// Database schema
const SCHEMA = `
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,  -- WhatsApp phone number
  user_name TEXT,                -- User's name if available
  last_active TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expire_at TIMESTAMP NOT NULL,  -- When to expire this conversation
  metadata TEXT                  -- JSON string for additional metadata
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,            -- 'user' or 'assistant'
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  metadata TEXT,                 -- JSON string for message-specific metadata
  FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);

-- Window Specifications table (structured data extraction)
CREATE TABLE IF NOT EXISTS window_specifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  location TEXT,                 -- e.g., "kitchen", "bedroom"
  width REAL,                    -- in inches
  height REAL,                   -- in inches
  window_type TEXT,              -- e.g., "Standard", "Bay", "Shaped"
  glass_type TEXT,               -- e.g., "Double pane", "Triple pane"
  features TEXT,                 -- JSON array of features like "Grilles", "Low-E glass"
  timestamp TIMESTAMP NOT NULL,  -- When this specification was completed
  FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_window_specs_conversation_id ON window_specifications (conversation_id);
`;

/**
 * Initialize the database schema
 * @param {sqlite3.Database} db - The database connection
 * @returns {Promise<void>}
 */
function initSchema(db) {
  return new Promise((resolve, reject) => {
    db.exec(SCHEMA, (err) => {
      if (err) {
        logger.error(`Failed to initialize database schema: ${err.message}`);
        reject(err);
        return;
      }
      logger.info('Database schema initialized successfully');
      resolve();
    });
  });
}

/**
 * Get database connection
 * @returns {Promise<sqlite3.Database>} Database connection
 */
async function getConnection() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbConfig.DB_PATH, async (err) => {
      if (err) {
        logger.error(`Failed to connect to database: ${err.message}`);
        reject(err);
        return;
      }

      logger.debug(`Connected to SQLite database at ${dbConfig.DB_PATH}`);

      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // Initialize schema if needed
      if (dbConfig.INIT_SCHEMA) {
        try {
          await initSchema(db);
        } catch (schemaErr) {
          reject(schemaErr);
          return;
        }
      }
      
      resolve(db);
    });
  });
}

module.exports = {
  getConnection,
  initSchema,
};