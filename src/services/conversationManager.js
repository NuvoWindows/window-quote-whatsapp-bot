/**
 * Conversation Manager Service
 * Handles persistent storage and retrieval of conversation context
 */

const database = require('../utils/database');
const logger = require('../utils/logger');
const config = require('../config/config');
const windowSpecParser = require('../utils/windowSpecParser');
const contextSummarizer = require('../utils/contextSummarizer');
const tokenEstimator = require('../utils/tokenEstimator');

// Constants
const DEFAULT_CONTEXT_LIMIT = 10; // Number of recent messages to include by default
const CONVERSATION_EXPIRY_DAYS = config.db.conversation_expiry_days; // Expiry days from config
const MAX_TOKEN_ESTIMATE = 8000; // Approximate token limit for context

class ConversationManager {
  constructor() {
    this.initialized = false;
    this.db = null;
    this.init();
  }

  /**
   * Initialize the conversation manager
   */
  async init() {
    try {
      this.db = await database.getConnection();
      this.initialized = true;
      logger.info('Conversation manager initialized successfully');
      
      // Set up scheduled cleanup of expired conversations
      setInterval(() => this.expireOldConversations(), 24 * 60 * 60 * 1000); // Once per day
    } catch (err) {
      logger.error(`Failed to initialize conversation manager: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ensure the database is initialized before proceeding
   */
  async ensureInitialized() {
    if (!this.initialized) {
      logger.debug('Waiting for conversation manager initialization...');
      await this.init();
    }
  }

  /**
   * Get or create a conversation for a user
   * @param {string} userId - The user's WhatsApp ID (phone number)
   * @param {string} userName - The user's name (if available)
   * @returns {Promise<Object>} - The conversation object
   */
  async getOrCreateConversation(userId, userName = 'there') {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      // First try to get existing conversation
      this.db.get(
        'SELECT * FROM conversations WHERE user_id = ?',
        [userId],
        async (err, conversation) => {
          if (err) {
            logger.error(`Error getting conversation for ${userId}: ${err.message}`);
            reject(err);
            return;
          }
          
          const now = new Date().toISOString();
          const expireDate = new Date();
          expireDate.setDate(expireDate.getDate() + CONVERSATION_EXPIRY_DAYS);
          
          // If conversation exists, update last_active timestamp
          if (conversation) {
            logger.debug(`Found existing conversation for ${userId}`);
            
            this.db.run(
              'UPDATE conversations SET last_active = ?, user_name = ? WHERE id = ?',
              [now, userName, conversation.id],
              (updateErr) => {
                if (updateErr) {
                  logger.error(`Error updating conversation timestamp: ${updateErr.message}`);
                  reject(updateErr);
                  return;
                }
                
                resolve(conversation);
              }
            );
          } else {
            // Create new conversation
            logger.info(`Creating new conversation for ${userId}`);
            
            this.db.run(
              'INSERT INTO conversations (user_id, user_name, last_active, created_at, expire_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
              [userId, userName, now, now, expireDate.toISOString(), '{}'],
              function(insertErr) {
                if (insertErr) {
                  logger.error(`Error creating conversation for ${userId}: ${insertErr.message}`);
                  reject(insertErr);
                  return;
                }
                
                // Get the newly created conversation
                resolve({
                  id: this.lastID,
                  user_id: userId,
                  user_name: userName,
                  last_active: now,
                  created_at: now,
                  expire_at: expireDate.toISOString(),
                  metadata: '{}'
                });
              }
            );
          }
        }
      );
    });
  }

  /**
   * Add a message to a conversation
   * @param {string} userId - The user's WhatsApp ID
   * @param {string} role - The message role ('user' or 'assistant')
   * @param {string} content - The message content
   * @param {Object} metadata - Optional metadata about the message
   * @returns {Promise<Object>} - The saved message
   */
  async addMessage(userId, role, content, metadata = {}) {
    await this.ensureInitialized();
    
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(userId);
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO messages (conversation_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)',
        [conversation.id, role, content, now, JSON.stringify(metadata)],
        function(err) {
          if (err) {
            logger.error(`Error adding message to conversation ${conversation.id}: ${err.message}`);
            reject(err);
            return;
          }
          
          logger.debug(`Added ${role} message to conversation ${conversation.id}`);
          
          resolve({
            id: this.lastID,
            conversation_id: conversation.id,
            role,
            content,
            timestamp: now,
            metadata: JSON.stringify(metadata)
          });
        }
      );
    });
  }

  /**
   * Get conversation context for Claude API
   * @param {string} userId - The user's WhatsApp ID
   * @param {number} limit - Maximum number of messages to include (default: DEFAULT_CONTEXT_LIMIT)
   * @param {number} maxTokens - Maximum tokens to include in context (default: MAX_TOKEN_ESTIMATE)
   * @returns {Promise<Array>} - Array of message objects for Claude API
   */
  async getConversationContext(userId, limit = DEFAULT_CONTEXT_LIMIT, maxTokens = MAX_TOKEN_ESTIMATE) {
    await this.ensureInitialized();

    const conversation = await this.getOrCreateConversation(userId);

    return new Promise((resolve, reject) => {
      // Get more messages than the default limit to allow for summarization
      const expandedLimit = Math.max(limit * 3, 30);
      
      this.db.all(
        `SELECT * FROM messages
         WHERE conversation_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [conversation.id, expandedLimit],
        async (err, messages) => {
          if (err) {
            logger.error(`Error getting messages for conversation ${conversation.id}: ${err.message}`);
            reject(err);
            return;
          }

          // Format messages for Claude API and reverse to chronological order
          const formattedMessages = messages
            .map(msg => ({
              role: msg.role,
              content: msg.content
            }))
            .reverse();

          logger.debug(`Retrieved ${formattedMessages.length} messages for conversation context`);

          // Try to extract and save window specifications
          await this.checkForWindowSpecifications(userId, formattedMessages);

          // Add window specifications as context prefix if available
          const enhancedContext = await this.enhanceContextWithSpecifications(userId, formattedMessages);
          
          // Calculate token estimate for enhanced context
          const tokenCount = tokenEstimator.estimateConversationTokens(enhancedContext);
          
          // Check if we need to optimize context for token limits
          if (tokenCount > maxTokens) {
            logger.info(`Context exceeds token limit (${tokenCount} > ${maxTokens}), applying summarization`, {
              userId,
              message_count: enhancedContext.length,
              token_count: tokenCount,
              token_limit: maxTokens
            });
            
            // Get summarized context within token limits
            const optimizedContext = await this.summarizeConversationContext(enhancedContext, maxTokens);
            
            logger.debug(`Optimized context from ${enhancedContext.length} to ${optimizedContext.length} messages`);
            resolve(optimizedContext);
          } else {
            // Context is within token limits, return as is
            logger.debug(`Context within token limits (${tokenCount} <= ${maxTokens})`);
            resolve(enhancedContext);
          }
        }
      );
    });
  }
  
  /**
   * Summarize conversation context to stay within token limits
   * @param {Array} context - Full conversation context with messages
   * @param {number} maxTokens - Maximum tokens for output context
   * @returns {Array} - Summarized context within token limits
   */
  async summarizeConversationContext(context, maxTokens = MAX_TOKEN_ESTIMATE) {
    try {
      // First, check if there's window specifications in the context
      const hasSpecsMessage = context.some(msg => 
        msg.role === 'system' && msg.content.includes('Previous window specifications')
      );
      
      // Separate system messages (specs) from regular conversation
      const systemMessages = context.filter(msg => msg.role === 'system');
      const conversationMessages = context.filter(msg => msg.role !== 'system');
      
      // Calculate tokens used by system messages
      const systemTokens = tokenEstimator.estimateConversationTokens(systemMessages);
      
      // Remaining tokens for conversation content
      const remainingTokens = maxTokens - systemTokens;
      
      // Optimize conversation messages to fit within remaining tokens
      const optimizedConversation = contextSummarizer.optimizeContext(
        conversationMessages,
        remainingTokens
      );
      
      // Combine system messages and optimized conversation
      const optimizedContext = [...systemMessages, ...optimizedConversation];
      
      logger.info('Successfully summarized conversation context', {
        original_length: context.length,
        summarized_length: optimizedContext.length,
        system_messages: systemMessages.length,
        estimated_tokens: tokenEstimator.estimateConversationTokens(optimizedContext)
      });
      
      return optimizedContext;
    } catch (error) {
      logger.error(`Error summarizing conversation context: ${error.message}`, {
        error_stack: error.stack
      });
      
      // Fallback to truncation if summarization fails
      return context.slice(-DEFAULT_CONTEXT_LIMIT);
    }
  }

  /**
   * Enhance conversation context with window specifications
   * @param {string} userId - The user's WhatsApp ID
   * @param {Array} messages - Conversation messages
   * @returns {Promise<Array>} - Enhanced conversation context
   */
  async enhanceContextWithSpecifications(userId, messages) {
    try {
      // Get window specifications for this user
      const specs = await this.getWindowSpecifications(userId);

      // If no specifications, return original messages
      if (!specs || specs.length === 0) {
        return messages;
      }

      // Create a context summary of specifications
      const specSummary = specs.map(spec => {
        let summary = `${spec.location || 'Window'}: ${spec.width || '?'}×${spec.height || '?'} inches`;
        if (spec.window_type) summary += `, ${spec.window_type} type`;
        if (spec.glass_type) summary += `, ${spec.glass_type}`;
        if (spec.features && spec.features.length > 0) {
          summary += `, with ${spec.features.join(' and ')}`;
        }
        return summary;
      }).join('; ');

      // Add system message at the beginning with specification context
      if (specSummary) {
        const enhancedMessages = [
          {
            role: 'system',
            content: `Previous window specifications: ${specSummary}`
          },
          ...messages
        ];

        logger.debug('Enhanced context with window specifications', {
          userId,
          specs_count: specs.length,
          specs_summary: specSummary,
          context_message_count: enhancedMessages.length
        });
        return enhancedMessages;
      }

      return messages;
    } catch (err) {
      logger.error(`Error enhancing context with specifications: ${err.message}`);
      return messages; // Return original messages if enhancement fails
    }
  }

  /**
   * Check conversation for window specifications and save if found
   * @param {string} userId - The user's WhatsApp ID
   * @param {Array} messages - Conversation messages
   */
  async checkForWindowSpecifications(userId, messages) {
    try {
      // Parse specifications from messages
      const specs = windowSpecParser.parseWindowSpecifications(messages);

      // If we have complete specifications, save them
      if (specs.is_complete) {
        const existingSpecs = await this.getWindowSpecifications(userId);

        // Check if we already have similar specifications saved
        const isDuplicate = existingSpecs.some(existing =>
          existing.location === specs.location &&
          existing.width === specs.width &&
          existing.height === specs.height);

        // Only save if not a duplicate
        if (!isDuplicate) {
          await this.saveWindowSpecification(userId, specs);
          logger.info('Saved new window specifications', {
            userId,
            location: specs.location,
            dimensions: `${specs.width}×${specs.height}`
          });
        }
      }
    } catch (err) {
      logger.error(`Error checking for window specifications: ${err.message}`);
      // Non-critical error, don't throw
    }
  }

  /**
   * Get information about all active conversations
   * @returns {Promise<Array>} - Array of conversation objects
   */
  async listActiveConversations() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      this.db.all(
        `SELECT c.*, COUNT(m.id) as message_count 
         FROM conversations c
         LEFT JOIN messages m ON c.id = m.conversation_id
         WHERE c.expire_at > ?
         GROUP BY c.id
         ORDER BY c.last_active DESC`,
        [now],
        (err, conversations) => {
          if (err) {
            logger.error(`Error listing active conversations: ${err.message}`);
            reject(err);
            return;
          }
          
          logger.debug(`Retrieved ${conversations.length} active conversations`);
          resolve(conversations);
        }
      );
    });
  }

  /**
   * Delete conversations that have passed their expiry date
   * @returns {Promise<number>} - Number of conversations deleted
   */
  async expireOldConversations() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      this.db.run(
        'DELETE FROM conversations WHERE expire_at < ?',
        [now],
        function(err) {
          if (err) {
            logger.error(`Error expiring old conversations: ${err.message}`);
            reject(err);
            return;
          }
          
          const deletedCount = this.changes;
          if (deletedCount > 0) {
            logger.info(`Expired ${deletedCount} old conversations`);
          }
          
          resolve(deletedCount);
        }
      );
    });
  }

  /**
   * Delete a specific conversation
   * @param {string} userId - The user's WhatsApp ID
   * @returns {Promise<boolean>} - Whether a conversation was deleted
   */
  async deleteConversation(userId) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM conversations WHERE user_id = ?',
        [userId],
        function(err) {
          if (err) {
            logger.error(`Error deleting conversation for ${userId}: ${err.message}`);
            reject(err);
            return;
          }
          
          const deleted = this.changes > 0;
          if (deleted) {
            logger.info(`Deleted conversation for ${userId}`);
          } else {
            logger.debug(`No conversation found to delete for ${userId}`);
          }
          
          resolve(deleted);
        }
      );
    });
  }

  /**
   * Save window specifications from a conversation
   * @param {string} userId - The user's WhatsApp ID
   * @param {Object} specs - Window specifications object
   * @returns {Promise<Object>} - The saved specification
   */
  async saveWindowSpecification(userId, specs) {
    await this.ensureInitialized();
    
    const conversation = await this.getOrCreateConversation(userId);
    const now = new Date().toISOString();
    
    // Ensure features is serialized as JSON if it's an array
    const features = Array.isArray(specs.features) 
      ? JSON.stringify(specs.features) 
      : (specs.features || '[]');
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO window_specifications 
         (conversation_id, location, width, height, window_type, glass_type, features, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation.id,
          specs.location,
          specs.width,
          specs.height,
          specs.window_type,
          specs.glass_type,
          features,
          now
        ],
        function(err) {
          if (err) {
            logger.error(`Error saving window specification: ${err.message}`);
            reject(err);
            return;
          }
          
          logger.info(`Saved window specification for ${userId} (${specs.location})`);
          
          resolve({
            id: this.lastID,
            conversation_id: conversation.id,
            ...specs,
            features,
            timestamp: now
          });
        }
      );
    });
  }

  /**
   * Get all window specifications for a user
   * @param {string} userId - The user's WhatsApp ID
   * @returns {Promise<Array>} - Array of window specification objects
   */
  async getWindowSpecifications(userId) {
    await this.ensureInitialized();
    
    const conversation = await this.getOrCreateConversation(userId);
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM window_specifications WHERE conversation_id = ? ORDER BY timestamp DESC',
        [conversation.id],
        (err, specs) => {
          if (err) {
            logger.error(`Error getting window specifications: ${err.message}`);
            reject(err);
            return;
          }
          
          // Parse features JSON for each specification
          const parsedSpecs = specs.map(spec => ({
            ...spec,
            features: JSON.parse(spec.features || '[]')
          }));
          
          logger.debug(`Retrieved ${parsedSpecs.length} window specifications for ${userId}`);
          resolve(parsedSpecs);
        }
      );
    });
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close(err => {
          if (err) {
            logger.error(`Error closing database: ${err.message}`);
            reject(err);
            return;
          }
          logger.info('Database connection closed');
          this.initialized = false;
          resolve();
        });
      });
    }
  }
}

// Export singleton instance
module.exports = new ConversationManager();