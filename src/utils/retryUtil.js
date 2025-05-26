const logger = require('./logger');

/**
 * Generic utility for handling retries with exponential backoff
 */
class RetryUtil {
  /**
   * Create a retry utility with configurable options
   * @param {Object} options - Configuration options
   * @param {number} options.maxRetries - Maximum number of retry attempts
   * @param {number} options.baseDelayMs - Base delay between retries (ms)
   * @param {number} options.maxDelayMs - Maximum delay between retries (ms)
   * @param {boolean} options.useJitter - Whether to add randomness to delays
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 
                      parseInt(process.env.RETRY_MAX_ATTEMPTS || '3');
    this.baseDelayMs = options.baseDelayMs || 
                       parseInt(process.env.RETRY_BASE_DELAY_MS || '500');
    this.maxDelayMs = options.maxDelayMs || 
                      parseInt(process.env.RETRY_MAX_DELAY_MS || '10000');
    this.useJitter = options.useJitter !== false;
  }

  /**
   * Execute an operation with automatic retry for transient failures
   * @param {Function} operation - Async function to execute
   * @param {Function} isRetryable - Function to determine if an error is retryable
   * @param {Object} context - Execution context for logging
   * @returns {Promise<any>} - Result of operation
   * @throws {Object} - Enhanced error object if all retries fail
   */
  async executeWithRetry(operation, isRetryable, context = {}) {
    let attempts = 0;
    let lastError = null;

    while (attempts <= this.maxRetries) {
      try {
        // Execute the operation
        return await operation();
      } 
      catch (error) {
        lastError = error;
        attempts++;
        
        // Log the error
        logger.warn(`Operation failed (attempt ${attempts}/${this.maxRetries + 1})`, {
          error: error.message,
          operation: context.operation || 'unknown',
          attempt: attempts
        });
        
        // Check if error is retryable and we haven't exceeded max retries
        if (!isRetryable(error) || attempts > this.maxRetries) {
          // Enhance the error with retry information
          const enhancedError = error;
          enhancedError.retryInfo = {
            attempts,
            exhausted: attempts > this.maxRetries,
            operation: context.operation
          };
          throw enhancedError;
        }
        
        // Calculate backoff delay
        const delayMs = this.calculateBackoffDelay(attempts);
        
        // Log the retry attempt
        logger.info(`Retrying operation in ${delayMs}ms`, {
          operation: context.operation || 'unknown',
          attempt: attempts,
          delay: delayMs
        });
        
        // Wait before next attempt
        await this.sleep(delayMs);
      }
    }
    
    // This should never happen due to the throw in the catch block,
    // but added as a fallback
    throw new Error('Unexpected retry loop exit');
  }

  /**
   * Calculate backoff delay with exponential increase and optional jitter
   * @param {number} attempt - Current attempt (1-based)
   * @returns {number} - Delay in milliseconds
   */
  calculateBackoffDelay(attempt) {
    // Calculate exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt - 1);
    let delay = Math.min(exponentialDelay, this.maxDelayMs);
    
    // Add jitter if enabled (±25% randomness)
    if (this.useJitter) {
      const jitterFactor = 0.75 + (Math.random() * 0.5); // 0.75-1.25
      delay = Math.floor(delay * jitterFactor);
    }
    
    return delay;
  }

  /**
   * Sleep for the specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryUtil;