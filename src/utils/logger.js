/**
 * Logger utility for WhatsApp Window Quote Bot
 * Handles logging with rotation, filtering, and structured output
 */

const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');

// Default configuration - can be overridden by environment variables
const config = {
  LOG_DIR: process.env.LOG_DIR || 'logs',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  LOG_TO_FILE: process.env.LOG_TO_FILE === 'true',
  MAX_LOG_SIZE: parseInt(process.env.MAX_LOG_SIZE || (10 * 1024 * 1024)), // 10MB default
  MAX_LOG_FILES: parseInt(process.env.MAX_LOG_FILES || 10),
  REDACT_PII: process.env.REDACT_PII !== 'false', // Default to true
  CLAUDE_LOG_FILE: process.env.CLAUDE_LOG_FILE || 'claude.log'
};

// Create log directory if logging to file is enabled
if (config.LOG_TO_FILE && !fs.existsSync(config.LOG_DIR)) {
  try {
    fs.mkdirSync(config.LOG_DIR, { recursive: true });
  } catch (err) {
    console.error(`Failed to create log directory: ${err.message}`);
    // Fall back to logging to console only
    config.LOG_TO_FILE = false;
  }
}

// Define log level hierarchy for filtering
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Get current log level number for comparisons
const currentLogLevel = LOG_LEVELS[config.LOG_LEVEL.toLowerCase()] || LOG_LEVELS.info;

/**
 * Rotate a log file if it exceeds the maximum size
 * @param {string} logFile - Path to the log file
 */
function rotateLogIfNeeded(logFile) {
  try {
    if (!fs.existsSync(logFile)) return;
    
    const stats = fs.statSync(logFile);
    if (stats.size < config.MAX_LOG_SIZE) return;
    
    // Implement log rotation
    for (let i = config.MAX_LOG_FILES - 1; i > 0; i--) {
      const oldFile = `${logFile}.${i}`;
      const newFile = `${logFile}.${i + 1}`;
      
      if (fs.existsSync(oldFile)) {
        if (i === config.MAX_LOG_FILES - 1) {
          // Delete the oldest log file if we reached max files
          fs.unlinkSync(oldFile);
        } else {
          // Rename the file to increment its number
          fs.renameSync(oldFile, newFile);
        }
      }
    }
    
    // Rename the current log file to .1
    fs.renameSync(logFile, `${logFile}.1`);
  } catch (err) {
    console.error(`Log rotation error: ${err.message}`);
  }
}

/**
 * Sanitize sensitive information from logs
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function sanitize(data) {
  if (!config.REDACT_PII) return data;

  if (typeof data !== 'object' || data === null) return data;
  
  const result = Array.isArray(data) ? [...data] : { ...data };
  
  // Define patterns for sensitive information
  const patterns = [
    // Phone numbers
    { key: /(phone|mobile|cell|whatsapp|wa_id)/i, value: /\d{10,}/g, replacement: '[PHONE_REDACTED]' },
    // Email addresses
    { key: /(email|mail)/i, value: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
    // API keys
    { key: /(key|token|secret|password|api)/i, value: /[a-zA-Z0-9_-]{20,}/g, replacement: '[KEY_REDACTED]' }
  ];
  
  // Recursively process object
  function processValue(value) {
    if (typeof value === 'string') {
      // Apply all patterns to the string value
      let sanitized = value;
      patterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern.value, pattern.replacement);
      });
      return sanitized;
    } else if (typeof value === 'object' && value !== null) {
      return sanitize(value); // Recursive call for nested objects/arrays
    }
    return value;
  }
  
  // Process each property in the object
  if (Array.isArray(result)) {
    return result.map(processValue);
  } else {
    for (const [key, value] of Object.entries(result)) {
      // Check if the key matches any sensitive key pattern
      const isKeyPatternMatch = patterns.some(pattern => pattern.key.test(key));
      
      // If key is sensitive, redact the value entirely
      if (isKeyPatternMatch && typeof value === 'string') {
        result[key] = '[REDACTED]';
      } else {
        result[key] = processValue(value);
      }
    }
    return result;
  }
}

/**
 * Write to a log file with rotation
 * @param {string} fileName - Name of the log file
 * @param {string} content - Content to write
 */
function writeToLogFile(fileName, content) {
  if (!config.LOG_TO_FILE) return;
  
  try {
    const logPath = path.join(config.LOG_DIR, fileName);
    rotateLogIfNeeded(logPath);
    
    fs.appendFileSync(logPath, content + '\n');
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

/**
 * Generic logging function
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
  // Check if we should log at this level
  if (LOG_LEVELS[level] < currentLogLevel) return;
  
  const timestamp = new Date().toISOString();
  
  // Sanitize metadata to remove PII
  const sanitizedMeta = sanitize(meta);
  
  // Create log entry
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...sanitizedMeta
  };
  
  // Convert to formatted output
  const consoleOutput = `[${timestamp}] [${level.toUpperCase()}] ${message}${
    Object.keys(sanitizedMeta).length > 0 ? ' ' + JSON.stringify(sanitizedMeta) : ''
  }`;
  
  const fileOutput = JSON.stringify(logEntry);
  
  // Output to console
  if (level === 'error') {
    console.error(consoleOutput);
  } else {
    console.log(consoleOutput);
  }
  
  // Write to generic log file
  writeToLogFile(`${level}.log`, fileOutput);
}

/**
 * Log Claude API interactions
 * @param {Object} data - Claude API interaction data
 */
function logClaude(data) {
  try {
    // Ensure required fields are present
    if (!data.type) {
      throw new Error('Claude log entry must have a "type" field');
    }
    
    const timestamp = new Date().toISOString();
    const sanitizedData = sanitize(data);
    
    // Add standard fields
    const logEntry = {
      timestamp,
      ...sanitizedData,
      processed_at: timestamp
    };
    
    // Log to console (condensed version)
    console.log(
      `[${timestamp}] [CLAUDE] ${data.type}: ${
        data.summary || data.message || JSON.stringify(data).substring(0, 100) + '...'
      }`
    );
    
    // Write full entry to Claude-specific log file
    writeToLogFile(config.CLAUDE_LOG_FILE, JSON.stringify(logEntry));
    
    // Also log to appropriate level based on type
    if (data.type === 'error') {
      log('error', `Claude API error: ${data.message || 'Unknown error'}`, data);
    }
  } catch (err) {
    // Make sure logging errors don't crash the app
    console.error(`Failed to log Claude interaction: ${err.message}`);
  }
}

/**
 * Filter Claude logs by criteria
 * @param {Object} criteria - Filter criteria (date range, query type, etc.)
 * @returns {Promise<Array>} - Filtered log entries
 */
async function filterClaudeLogs(criteria = {}) {
  if (!config.LOG_TO_FILE) {
    throw new Error('Filtering logs requires file logging to be enabled');
  }
  
  try {
    const logPath = path.join(config.LOG_DIR, config.CLAUDE_LOG_FILE);
    if (!fs.existsSync(logPath)) {
      return [];
    }
    
    // Read the log file
    const content = await fs.promises.readFile(logPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse each line as JSON
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(entry => entry !== null);
    
    // Apply filters
    return entries.filter(entry => {
      // Filter by date range
      if (criteria.startDate && new Date(entry.timestamp) < new Date(criteria.startDate)) {
        return false;
      }
      if (criteria.endDate && new Date(entry.timestamp) > new Date(criteria.endDate)) {
        return false;
      }
      
      // Filter by query type
      if (criteria.type && entry.type !== criteria.type) {
        return false;
      }
      
      // Filter by user/phone
      if (criteria.user && entry.user !== criteria.user) {
        return false;
      }
      
      // Filter by query text content
      if (criteria.query && 
          typeof entry.query === 'string' && 
          !entry.query.toLowerCase().includes(criteria.query.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  } catch (err) {
    console.error(`Error filtering Claude logs: ${err.message}`);
    throw err;
  }
}

/**
 * Categorize an error based on its message and stack trace
 * @param {Error} error - The error to categorize
 * @returns {string} - Error category
 */
function categorizeError(error) {
  const errorCategories = {
    VALIDATION: ['invalid input', 'validation failed', 'required field', 'not a valid'],
    PARSING: ['parse error', 'cannot process', 'invalid format', 'syntax error'],
    CLAUDE_API: ['claude api', 'anthropic', 'llm', 'completion failed', 'context length', 'rate limit'],
    WHATSAPP_API: ['whatsapp', 'message delivery', 'send failed', 'recipient'],
    DATABASE: ['database', 'query failed', 'connection', 'timeout', 'sql', 'db error'],
    CONVERSATION: ['context', 'specification', 'conversation state', 'message history'],
    SYSTEM: ['system', 'memory', 'crash', 'unexpected', 'internal error']
  };
  
  const errorString = `${error.message} ${error.stack || ''}`.toLowerCase();
  
  for (const [category, patterns] of Object.entries(errorCategories)) {
    if (patterns.some(pattern => errorString.includes(pattern))) {
      return category;
    }
  }
  
  return 'UNKNOWN';
}

/**
 * Get appropriate log level for an error category
 * @param {string} category - Error category
 * @returns {string} - Log level
 */
function getCategoryLogLevel(category) {
  const levelMap = {
    VALIDATION: 'warn',
    PARSING: 'warn',
    CLAUDE_API: 'error',
    WHATSAPP_API: 'error',
    DATABASE: 'error',
    CONVERSATION: 'warn',
    SYSTEM: 'error'
  };
  
  return levelMap[category] || 'error';
}

/**
 * Generate a unique error ID
 * @returns {string} - Unique error ID
 */
function generateErrorId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ERR-${timestamp}-${random}`;
}

/**
 * Log an error with rich context and categorization
 * @param {Error} error - The error object
 * @param {Object} context - Additional context about the error
 * @returns {Object} - Error metadata including ID and category
 */
function logError(error, context = {}) {
  try {
    // Categorize the error
    const category = categorizeError(error);
    const errorId = generateErrorId();
    
    // Create enriched error context
    const enrichedContext = {
      errorId,
      errorType: error.constructor.name,
      errorCategory: category,
      stackTrace: error.stack,
      timestamp: new Date().toISOString(),
      ...context
    };
    
    // Use appropriate log level based on error category
    const level = getCategoryLogLevel(category);
    
    // Log using the standard logging function
    log(level, `[${category}] ${error.message}`, enrichedContext);
    
    // Write to error-specific log file
    if (config.LOG_TO_FILE) {
      writeToLogFile('errors.log', JSON.stringify({
        timestamp: new Date().toISOString(),
        errorId,
        category,
        message: error.message,
        ...enrichedContext
      }));
    }
    
    // Return error metadata for reference
    return { errorId, category };
  } catch (loggingError) {
    // Fallback if error logging itself fails
    console.error('Failed to log error:', loggingError);
    console.error('Original error:', error);
    return { errorId: 'ERROR_LOGGING_FAILED', category: 'SYSTEM' };
  }
}

// Export public methods
module.exports = {
  // Standard logging functions
  debug: (message, meta = {}) => log('debug', message, meta),
  info: (message, meta = {}) => log('info', message, meta),
  warn: (message, meta = {}) => log('warn', message, meta),
  error: (message, meta = {}) => log('error', message, meta),
  
  // Enhanced error logging
  logError,
  
  // Claude-specific logging
  logClaude,
  filterClaudeLogs,
  
  // Configuration
  setLogLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      config.LOG_LEVEL = level;
      return true;
    }
    return false;
  }
};