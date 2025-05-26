/**
 * ErrorContextService
 * 
 * Captures comprehensive error context for recovery and debugging.
 * Preserves conversation state, user context, and system state at the time
 * of error to enable intelligent recovery strategies.
 */

const logger = require('../utils/logger');

class ErrorContextService {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
  }
  
  /**
   * Capture comprehensive error context at the time of failure
   * @param {string} userId - User identifier
   * @param {Error} error - The error that occurred
   * @param {string} operation - Operation that was being performed
   * @returns {Object} - Captured error context
   */
  async captureErrorContext(userId, error, operation) {
    try {
      const timestamp = new Date().toISOString();
      
      // Capture all available context
      const context = {
        // Error details
        errorId: error.errorId || `err_${Date.now().toString(36)}`,
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorCode: error.code || error.status || 'UNKNOWN',
        errorStack: error.stack,
        
        // Operation context
        operation,
        timestamp,
        
        // User context
        userId,
        lastUserMessage: await this.getLastUserMessage(userId),
        conversationPhase: await this.getConversationPhase(userId),
        
        // Conversation state
        partialSpecifications: await this.getPartialSpecifications(userId),
        conversationContext: await this.getRecentConversationContext(userId),
        pendingOperation: await this.getPendingOperation(userId),
        
        // System context
        systemLoad: await this.getSystemLoad(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        
        // Recovery hints
        recoveryHints: this.generateRecoveryHints(error, operation)
      };
      
      // Save error context for potential recovery
      await this.saveErrorContext(userId, context);
      
      logger.info('Captured error context', {
        userId,
        errorId: context.errorId,
        operation,
        conversationPhase: context.conversationPhase
      });
      
      return context;
      
    } catch (contextError) {
      // If we can't capture context, log the issue but don't fail
      logger.logError(contextError, {
        operation: 'CAPTURE_ERROR_CONTEXT',
        userId,
        originalError: error.message
      });
      
      // Return minimal context
      return {
        errorId: `err_${Date.now().toString(36)}`,
        errorType: error.constructor.name,
        errorMessage: error.message,
        operation,
        timestamp: new Date().toISOString(),
        userId,
        contextCaptureError: true
      };
    }
  }
  
  /**
   * Get the last message from the user
   * @param {string} userId - User identifier
   * @returns {string|null} - Last user message or null
   */
  async getLastUserMessage(userId) {
    try {
      const context = await this.conversationManager.getConversationContext(userId, 5);
      
      // Find the most recent user message
      for (let i = context.length - 1; i >= 0; i--) {
        if (context[i].role === 'user') {
          return context[i].content;
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to get last user message', {
        userId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Determine the current conversation phase
   * @param {string} userId - User identifier
   * @returns {string} - Conversation phase
   */
  async getConversationPhase(userId) {
    try {
      // Get partial specifications to determine phase
      const specs = await this.conversationManager.getPartialSpecification(userId);
      const messages = await this.conversationManager.getConversationContext(userId, 3);
      
      if (!specs || Object.keys(specs).length === 0) {
        if (!messages || messages.length < 2) {
          return 'INITIAL_GREETING';
        }
        return 'SPECIFICATION_GATHERING_START';
      }
      
      // Check if we have critical specs
      const hasCriticalSpecs = specs.width && specs.height && specs.operation_type;
      
      if (hasCriticalSpecs) {
        return 'SPECIFICATION_COMPLETE';
      }
      
      // Check if we're waiting for clarification
      const lastAssistantMessage = messages.find(m => m.role === 'assistant');
      if (lastAssistantMessage?.content.includes('?')) {
        return 'AWAITING_USER_RESPONSE';
      }
      
      return 'SPECIFICATION_GATHERING';
      
    } catch (error) {
      logger.warn('Failed to determine conversation phase', {
        userId,
        error: error.message
      });
      return 'UNKNOWN';
    }
  }
  
  /**
   * Get partial specifications for the user
   * @param {string} userId - User identifier
   * @returns {Object|null} - Partial specifications or null
   */
  async getPartialSpecifications(userId) {
    try {
      return await this.conversationManager.getPartialSpecification(userId);
    } catch (error) {
      logger.warn('Failed to get partial specifications', {
        userId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Get recent conversation context
   * @param {string} userId - User identifier
   * @returns {Array} - Recent conversation messages
   */
  async getRecentConversationContext(userId) {
    try {
      return await this.conversationManager.getConversationContext(userId, 5);
    } catch (error) {
      logger.warn('Failed to get conversation context', {
        userId,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Get any pending operations for the user
   * @param {string} userId - User identifier
   * @returns {Object|null} - Pending operation info or null
   */
  async getPendingOperation(userId) {
    try {
      // Check for context flags that indicate pending operations
      const collectingMeasurement = await this.conversationManager.getContextFlag(
        userId, 
        'collecting_measurement_info'
      );
      
      if (collectingMeasurement) {
        return {
          type: 'COLLECTING_MEASUREMENT_INFO',
          active: true
        };
      }
      
      // Could check for other pending operations here
      
      return null;
    } catch (error) {
      logger.warn('Failed to get pending operation', {
        userId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Get basic system load information
   * @returns {Object} - System load metrics
   */
  async getSystemLoad() {
    try {
      const loadavg = require('os').loadavg();
      const cpuUsage = process.cpuUsage();
      
      return {
        loadAverage: loadavg,
        cpuUsage: cpuUsage,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Failed to get system load', {
        error: error.message
      });
      return { available: false };
    }
  }
  
  /**
   * Generate recovery hints based on error and operation
   * @param {Error} error - The error that occurred
   * @param {string} operation - Operation that failed
   * @returns {Array} - Array of recovery hint strings
   */
  generateRecoveryHints(error, operation) {
    const hints = [];
    
    // Error-type specific hints
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      hints.push('RETRY_WITH_BACKOFF');
      hints.push('CHECK_NETWORK_CONNECTIVITY');
    }
    
    if (error.status === 429 || error.message.includes('rate limit')) {
      hints.push('APPLY_RATE_LIMITING');
      hints.push('RETRY_AFTER_DELAY');
    }
    
    if (error.message.includes('database') || error.message.includes('connection')) {
      hints.push('CHECK_DATABASE_CONNECTION');
      hints.push('USE_CACHED_DATA_IF_AVAILABLE');
    }
    
    // Operation-specific hints
    switch (operation) {
      case 'MESSAGE_PROCESSING':
        hints.push('PRESERVE_USER_MESSAGE');
        hints.push('SEND_ERROR_ACKNOWLEDGMENT');
        break;
        
      case 'CLAUDE_GENERATION':
        hints.push('RETRY_WITH_SIMPLIFIED_PROMPT');
        hints.push('USE_FALLBACK_RESPONSE');
        break;
        
      case 'WHATSAPP_SEND':
        hints.push('QUEUE_MESSAGE_FOR_RETRY');
        hints.push('NOTIFY_USER_OF_DELAY');
        break;
        
      case 'QUOTE_GENERATION':
        hints.push('PRESERVE_SPECIFICATIONS');
        hints.push('OFFER_ALTERNATIVE_CONTACT_METHOD');
        break;
    }
    
    return hints;
  }
  
  /**
   * Save error context for later recovery
   * @param {string} userId - User identifier
   * @param {Object} context - Error context object
   */
  async saveErrorContext(userId, context) {
    try {
      // Save to conversation metadata for quick access
      await this.conversationManager.setConversationContext(
        userId, 
        'lastErrorContext', 
        {
          errorId: context.errorId,
          timestamp: context.timestamp,
          operation: context.operation,
          errorType: context.errorType,
          conversationPhase: context.conversationPhase,
          recoveryHints: context.recoveryHints
        }
      );
      
      // In a production system, you might also want to save to a separate
      // error tracking database for longer-term analysis
      
    } catch (error) {
      logger.logError(error, {
        operation: 'SAVE_ERROR_CONTEXT',
        userId,
        contextErrorId: context.errorId
      });
    }
  }
  
  /**
   * Get the last error context for a user
   * @param {string} userId - User identifier
   * @returns {Object|null} - Last error context or null
   */
  async getLastErrorContext(userId) {
    try {
      const context = await this.conversationManager.getConversationContext(userId, 1);
      
      // Look for system messages with error context
      const systemMessage = context.find(msg => 
        msg.role === 'system' && 
        msg.content && 
        msg.content.includes('lastErrorContext')
      );
      
      if (systemMessage && systemMessage.lastErrorContext) {
        return systemMessage.lastErrorContext;
      }
      
      return null;
      
    } catch (error) {
      logger.warn('Failed to get last error context', {
        userId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Clear error context for a user
   * @param {string} userId - User identifier
   */
  async clearErrorContext(userId) {
    try {
      await this.conversationManager.setConversationContext(userId, 'lastErrorContext', null);
      
      logger.debug('Cleared error context', { userId });
      
    } catch (error) {
      logger.logError(error, {
        operation: 'CLEAR_ERROR_CONTEXT',
        userId
      });
    }
  }
}

module.exports = ErrorContextService;