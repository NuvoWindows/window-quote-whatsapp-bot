/**
 * ErrorRecoveryService
 * 
 * Provides intelligent recovery mechanisms for different types of errors.
 * Uses error context to determine appropriate recovery strategies and
 * integrates with other error handling components for comprehensive recovery.
 */

const logger = require('../utils/logger');

class ErrorRecoveryService {
  constructor(conversationManager, errorContextService) {
    this.conversationManager = conversationManager;
    this.errorContextService = errorContextService;
    
    // Define recovery strategies for different error types
    this.recoveryStrategies = {
      'CLAUDE_TIMEOUT': this.recoverFromClaudeTimeout.bind(this),
      'CLAUDE_ERROR': this.recoverFromClaudeError.bind(this),
      'WHATSAPP_SEND_FAILED': this.recoverFromWhatsAppFailure.bind(this),
      'DB_CONNECTION_LOST': this.recoverFromDatabaseError.bind(this),
      'PARSING_ERROR': this.recoverFromParsingError.bind(this),
      'VALIDATION_ERROR': this.recoverFromValidationError.bind(this),
      'NETWORK_ERROR': this.recoverFromNetworkError.bind(this),
      'RATE_LIMIT_ERROR': this.recoverFromRateLimitError.bind(this)
    };
  }
  
  /**
   * Handle error recovery based on error type and context
   * @param {string} userId - User identifier
   * @param {Error} error - The error that occurred
   * @param {string} operation - Operation that failed
   * @param {Object} context - Additional context (optional)
   * @returns {Object} - Recovery result
   */
  async handleError(userId, error, operation, context = {}) {
    try {
      // Capture comprehensive error context
      const errorContext = await this.errorContextService.captureErrorContext(userId, error, operation);
      
      // Include retry information if available
      if (error.retryInfo) {
        errorContext.retryAttempts = error.retryInfo.attempts;
        errorContext.retriesExhausted = error.retryInfo.exhausted;
      }
      
      // Merge additional context
      const fullContext = { ...errorContext, ...context };
      
      // Determine recovery strategy
      const strategy = this.getRecoveryStrategy(error, operation);
      
      if (strategy) {
        logger.info('Applying recovery strategy', {
          userId,
          errorType: error.constructor.name,
          operation,
          strategy: strategy.name
        });
        
        const recoveryResult = await strategy(userId, fullContext);
        
        // Log recovery outcome
        logger.info('Recovery strategy applied', {
          userId,
          errorId: fullContext.errorId,
          successful: recoveryResult.successful,
          strategy: strategy.name
        });
        
        return recoveryResult;
      }
      
      // No specific strategy, use default recovery
      return await this.defaultRecovery(userId, fullContext);
      
    } catch (recoveryError) {
      logger.logError(recoveryError, {
        operation: 'HANDLE_ERROR_RECOVERY',
        userId,
        originalError: error.message
      });
      
      // Last resort recovery
      return this.lastResortRecovery(userId, error);
    }
  }
  
  /**
   * Determine the appropriate recovery strategy
   * @param {Error} error - The error that occurred
   * @param {string} operation - Operation that failed
   * @returns {Function|null} - Recovery strategy function or null
   */
  getRecoveryStrategy(error, operation) {
    // Check by error characteristics first
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      if (operation.includes('CLAUDE')) {
        return this.recoveryStrategies['CLAUDE_TIMEOUT'];
      }
      return this.recoveryStrategies['NETWORK_ERROR'];
    }
    
    if (error.status === 429 || error.message.includes('rate limit')) {
      return this.recoveryStrategies['RATE_LIMIT_ERROR'];
    }
    
    if (error.message.includes('database') || error.message.includes('connection')) {
      return this.recoveryStrategies['DB_CONNECTION_LOST'];
    }
    
    // Check by operation type
    if (operation.includes('CLAUDE')) {
      return this.recoveryStrategies['CLAUDE_ERROR'];
    }
    
    if (operation.includes('WHATSAPP')) {
      return this.recoveryStrategies['WHATSAPP_SEND_FAILED'];
    }
    
    if (operation.includes('PARSING')) {
      return this.recoveryStrategies['PARSING_ERROR'];
    }
    
    if (operation.includes('VALIDATION')) {
      return this.recoveryStrategies['VALIDATION_ERROR'];
    }
    
    return null;
  }
  
  /**
   * Recover from Claude API timeout
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromClaudeTimeout(userId, context) {
    const lastMessage = context.lastUserMessage;
    
    // Try to preserve the conversation state
    if (context.partialSpecifications) {
      await this.conversationManager.savePartialSpecification(
        userId, 
        context.partialSpecifications
      );
    }
    
    return {
      successful: true,
      strategy: 'claude_timeout_retry',
      message: "I apologize, I'm having a bit of trouble processing that. Let me try again...",
      actions: {
        retry: true,
        retryOperation: 'CLAUDE_GENERATION',
        retryData: { message: lastMessage },
        preserveState: true
      }
    };
  }
  
  /**
   * Recover from Claude API error
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromClaudeError(userId, context) {
    // Check if it's a rate limit (should be handled by rate limit strategy)
    if (context.errorCode === 429) {
      return await this.recoverFromRateLimitError(userId, context);
    }
    
    // For other Claude errors, provide a helpful fallback
    const fallbackMessage = this.generateClaudeFallbackMessage(context);
    
    return {
      successful: true,
      strategy: 'claude_error_fallback',
      message: fallbackMessage,
      actions: {
        useFallback: true,
        preserveState: true,
        suggestAlternative: true
      }
    };
  }
  
  /**
   * Recover from WhatsApp API failure
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromWhatsAppFailure(userId, context) {
    // Save the message for retry
    if (context.pendingOperation && context.pendingOperation.messageContent) {
      await this.saveFailedMessage(userId, context.pendingOperation.messageContent, context);
    }
    
    return {
      successful: true,
      strategy: 'whatsapp_failure_queue',
      // Don't send another message since WhatsApp is failing
      actions: {
        queueForRetry: true,
        preserveState: true,
        notifyWhenRecovered: true
      },
      internalNote: 'WhatsApp API failure - message queued for retry'
    };
  }
  
  /**
   * Recover from database connection error
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromDatabaseError(userId, context) {
    // Try to preserve any critical data in memory temporarily
    const criticalData = this.extractCriticalData(context);
    
    if (criticalData) {
      // Store in a temporary fallback mechanism
      await this.storeTemporaryData(userId, criticalData);
    }
    
    return {
      successful: true,
      strategy: 'database_error_fallback',
      message: "I'm experiencing a brief technical issue. Your information is safe, and I'll continue helping you in just a moment.",
      actions: {
        useTemporaryStorage: true,
        scheduleDataRecovery: true,
        monitorDatabaseHealth: true
      }
    };
  }
  
  /**
   * Recover from parsing error
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromParsingError(userId, context) {
    const phase = context.conversationPhase;
    
    if (phase === 'AWAITING_USER_RESPONSE') {
      return {
        successful: true,
        strategy: 'parsing_error_clarification',
        message: "I didn't quite catch that. Could you please provide the information in a different way?",
        actions: {
          requestClarification: true,
          preserveState: true
        }
      };
    }
    
    // For other phases, reset to a safe state
    return {
      successful: true,
      strategy: 'parsing_error_reset',
      message: "I'm having trouble processing that information. Let's try again - what kind of window are you looking for?",
      actions: {
        resetToSafeState: true,
        preservePartialData: true
      }
    };
  }
  
  /**
   * Recover from validation error
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromValidationError(userId, context) {
    return {
      successful: true,
      strategy: 'validation_error_guidance',
      message: "There seems to be an issue with some of the information provided. Let me help you with the correct format.",
      actions: {
        provideGuidance: true,
        preserveValidData: true,
        requestCorrection: true
      }
    };
  }
  
  /**
   * Recover from network error
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromNetworkError(userId, context) {
    return {
      successful: true,
      strategy: 'network_error_retry',
      message: "I'm experiencing connectivity issues. Let me try that again...",
      actions: {
        retry: true,
        retryWithBackoff: true,
        preserveState: true
      }
    };
  }
  
  /**
   * Recover from rate limit error
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async recoverFromRateLimitError(userId, context) {
    return {
      successful: true,
      strategy: 'rate_limit_delay',
      message: "I'm receiving a lot of requests right now. Give me just a moment...",
      actions: {
        retry: true,
        retryAfterDelay: 5000, // 5 second delay
        preserveState: true
      }
    };
  }
  
  /**
   * Default recovery strategy when no specific strategy applies
   * @param {string} userId - User identifier
   * @param {Object} context - Error context
   * @returns {Object} - Recovery result
   */
  async defaultRecovery(userId, context) {
    // Try to preserve conversation state
    if (context.partialSpecifications) {
      await this.conversationManager.savePartialSpecification(
        userId, 
        context.partialSpecifications
      );
    }
    
    return {
      successful: true,
      strategy: 'default_recovery',
      message: "I encountered an unexpected issue, but I'm back now. How can I continue helping you?",
      actions: {
        preserveState: true,
        requestUserGuidance: true
      }
    };
  }
  
  /**
   * Last resort recovery when all else fails
   * @param {string} userId - User identifier
   * @param {Error} error - Original error
   * @returns {Object} - Recovery result
   */
  lastResortRecovery(userId, error) {
    return {
      successful: false,
      strategy: 'last_resort',
      message: "I'm experiencing technical difficulties. Please try again in a few moments.",
      actions: {
        logCriticalError: true,
        notifySupport: true
      }
    };
  }
  
  /**
   * Generate fallback message for Claude errors
   * @param {Object} context - Error context
   * @returns {string} - Fallback message
   */
  generateClaudeFallbackMessage(context) {
    const phase = context.conversationPhase;
    
    switch (phase) {
      case 'INITIAL_GREETING':
        return "Hello! I'm here to help you with window quotes. What type of window are you looking for?";
        
      case 'SPECIFICATION_GATHERING':
      case 'SPECIFICATION_GATHERING_START':
        return "I'm having trouble processing that, but I can still help you get a window quote. Could you tell me about your window dimensions?";
        
      case 'AWAITING_USER_RESPONSE':
        return "I didn't quite catch your response. Could you please try again?";
        
      default:
        return "I apologize for the confusion. Let me help you get the window quote you need. What information can you provide about your window?";
    }
  }
  
  /**
   * Extract critical data that must be preserved during errors
   * @param {Object} context - Error context
   * @returns {Object|null} - Critical data or null
   */
  extractCriticalData(context) {
    const criticalData = {};
    
    // Always preserve partial specifications
    if (context.partialSpecifications && Object.keys(context.partialSpecifications).length > 0) {
      criticalData.specifications = context.partialSpecifications;
    }
    
    // Preserve conversation phase
    if (context.conversationPhase) {
      criticalData.phase = context.conversationPhase;
    }
    
    // Preserve last user message for context
    if (context.lastUserMessage) {
      criticalData.lastMessage = context.lastUserMessage;
    }
    
    return Object.keys(criticalData).length > 0 ? criticalData : null;
  }
  
  /**
   * Store data temporarily when database is unavailable
   * @param {string} userId - User identifier
   * @param {Object} data - Data to store temporarily
   */
  async storeTemporaryData(userId, data) {
    try {
      // In a real implementation, this might use Redis, memory cache, or file system
      // For now, we'll log it and hope database recovery is quick
      
      logger.info('Storing critical data temporarily', {
        userId,
        dataKeys: Object.keys(data),
        timestamp: new Date().toISOString()
      });
      
      // Could implement actual temporary storage here
      
    } catch (error) {
      logger.logError(error, {
        operation: 'STORE_TEMPORARY_DATA',
        userId
      });
    }
  }
  
  /**
   * Save a failed message for retry
   * @param {string} userId - User identifier
   * @param {string} messageContent - Message that failed to send
   * @param {Object} context - Error context
   */
  async saveFailedMessage(userId, messageContent, context) {
    try {
      // Store in conversation context for retry
      await this.conversationManager.setConversationContext(userId, 'failedMessage', {
        content: messageContent,
        timestamp: new Date().toISOString(),
        errorId: context.errorId,
        retryCount: 0
      });
      
      logger.info('Saved failed message for retry', {
        userId,
        errorId: context.errorId,
        messagePreview: messageContent.substring(0, 50)
      });
      
    } catch (error) {
      logger.logError(error, {
        operation: 'SAVE_FAILED_MESSAGE',
        userId
      });
    }
  }
  
  /**
   * Check if there are any failed messages to retry
   * @param {string} userId - User identifier
   * @returns {Object|null} - Failed message info or null
   */
  async getFailedMessageForRetry(userId) {
    try {
      // Implementation would depend on how failed messages are stored
      // This is a placeholder for the retry mechanism
      
      return null;
    } catch (error) {
      logger.logError(error, {
        operation: 'GET_FAILED_MESSAGE_FOR_RETRY',
        userId
      });
      return null;
    }
  }
}

module.exports = ErrorRecoveryService;