/**
 * ErrorMonitoringService (Enhanced Version for Section 7)
 * 
 * Comprehensive monitoring system that detects error patterns,
 * provides actionable alerts, and enables proactive system improvement.
 */

const logger = require('../utils/logger');
const config = require('../config/config');

class ErrorMonitoringService {
  constructor() {
    // Initialize storage for error patterns
    this.errorPatterns = new Map();
    this.detectedPatterns = [];
    this.lastAlertTimes = new Map();
    
    // Configure thresholds with environment variables and priorities
    this.thresholds = {
      CLAUDE_API: { 
        count: parseInt(process.env.CLAUDE_ERROR_THRESHOLD || '5'), 
        window: parseInt(process.env.CLAUDE_ERROR_WINDOW || '300000'), // 5 minutes
        priority: 'high'
      },
      CLAUDE_TIMEOUT: { count: 5, window: 300000, priority: 'high' },
      CLAUDE_ERROR: { count: 5, window: 300000, priority: 'high' },
      WHATSAPP_API: { 
        count: parseInt(process.env.WHATSAPP_ERROR_THRESHOLD || '10'), 
        window: parseInt(process.env.WHATSAPP_ERROR_WINDOW || '300000'), // 5 minutes
        priority: 'high'
      },
      WHATSAPP_FAILURE: { count: 10, window: 300000, priority: 'high' },
      DATABASE: { 
        count: parseInt(process.env.DB_ERROR_THRESHOLD || '3'), 
        window: parseInt(process.env.DB_ERROR_WINDOW || '60000'), // 1 minute
        priority: 'critical'
      },
      DB_ERROR: { count: 3, window: 60000, priority: 'critical' },
      VALIDATION: { 
        count: parseInt(process.env.VALIDATION_ERROR_THRESHOLD || '20'), 
        window: parseInt(process.env.VALIDATION_ERROR_WINDOW || '600000'), // 10 minutes
        priority: 'medium'
      },
      VALIDATION_ERROR: { count: 20, window: 600000, priority: 'medium' },
      PARSING: { 
        count: parseInt(process.env.PARSING_ERROR_THRESHOLD || '15'), 
        window: parseInt(process.env.PARSING_ERROR_WINDOW || '600000'), // 10 minutes
        priority: 'medium'
      },
      PARSING_ERROR: { count: 15, window: 600000, priority: 'medium' },
      NETWORK_ERROR: { count: 8, window: 300000, priority: 'high' },
      SYSTEM: { 
        count: parseInt(process.env.SYSTEM_ERROR_THRESHOLD || '2'), 
        window: parseInt(process.env.SYSTEM_ERROR_WINDOW || '300000'), // 5 minutes
        priority: 'critical'
      },
      SYSTEM_ERROR: { count: 2, window: 300000, priority: 'critical' },
      UNKNOWN: { count: 10, window: 300000, priority: 'medium' }
    };
    
    // Initialize pattern detectors
    this.initializePatternDetectors();
    
    // Start periodic cleanup
    this.startCleanupTask();
  }
  
  /**
   * Initialize pattern detection strategies
   */
  initializePatternDetectors() {
    this.patternDetectors = {
      frequency: {
        detect: async (errorRecord, categoryErrors) => {
          return this.detectFrequencyPattern(errorRecord, categoryErrors);
        }
      },
      userImpact: {
        detect: async (errorRecord, categoryErrors) => {
          return this.detectUserImpactPattern(errorRecord, categoryErrors);
        }
      },
      errorChain: {
        detect: async (errorRecord) => {
          return this.detectErrorChainPattern(errorRecord);
        }
      },
      timeCorrelation: {
        detect: async (errorRecord, categoryErrors) => {
          return this.detectTimeCorrelationPattern(errorRecord, categoryErrors);
        }
      }
    };
  }
  
  /**
   * Track an error occurrence and check for patterns
   * @param {Error} error - The error that occurred
   * @param {string} operation - Operation that failed
   * @param {string} userId - User affected by the error
   * @returns {Object} - Tracking result
   */
  async trackError(error, operation, userId) {
    try {
      // Determine error category
      const category = this.categorizeError(error, operation);
      
      // Create enhanced error record
      const errorRecord = {
        timestamp: Date.now(),
        errorId: error.errorId || `err_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`,
        category,
        operation,
        userId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorCode: error.code || error.status || error.statusCode || 'unknown',
        retryAttempts: error.retryInfo?.attempts || 0,
        retriesExhausted: error.retryInfo?.exhausted || false
      };
      
      // Add to pattern tracking
      if (!this.errorPatterns.has(category)) {
        this.errorPatterns.set(category, []);
      }
      
      const categoryPatterns = this.errorPatterns.get(category);
      categoryPatterns.push(errorRecord);
      
      // Run pattern detection
      await this.detectPatterns(errorRecord, categoryPatterns);
      
      return {
        category,
        tracked: true,
        errorId: errorRecord.errorId
      };
      
    } catch (trackingError) {
      logger.logError(trackingError, {
        operation: 'TRACK_ERROR',
        originalError: error.message
      });
      
      return {
        category: 'UNKNOWN',
        tracked: false,
        error: trackingError.message
      };
    }
  }
  
  /**
   * Categorize error for tracking purposes
   * @param {Error} error - The error
   * @param {string} operation - Operation context
   * @returns {string} - Error category
   */
  categorizeError(error, operation) {
    // Check by error characteristics first
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      if (operation && operation.includes('CLAUDE')) {
        return 'CLAUDE_TIMEOUT';
      }
      return 'NETWORK_ERROR';
    }
    
    if (error.status === 429 || error.message.includes('rate limit')) {
      return 'RATE_LIMIT_ERROR';
    }
    
    if (error.message.includes('database') || error.message.includes('connection')) {
      return 'DB_ERROR';
    }
    
    // Check by operation type
    if (operation) {
      if (operation.includes('CLAUDE')) {
        return 'CLAUDE_ERROR';
      }
      if (operation.includes('WHATSAPP')) {
        return 'WHATSAPP_FAILURE';
      }
      if (operation.includes('PARSING')) {
        return 'PARSING_ERROR';
      }
      if (operation.includes('VALIDATION')) {
        return 'VALIDATION_ERROR';
      }
    }
    
    // Default categorization
    if (error.constructor.name.includes('Network')) {
      return 'NETWORK_ERROR';
    }
    
    return 'SYSTEM_ERROR';
  }
  
  /**
   * Check if error frequency exceeds thresholds
   * @param {string} category - Error category
   * @param {Array} patterns - Error patterns for this category
   * @returns {Object|null} - Threshold violation info or null
   */
  checkThresholds(category, patterns) {
    const threshold = this.thresholds[category];
    
    if (!threshold) {
      return null;
    }
    
    const now = Date.now();
    const cutoff = now - threshold.window;
    
    // Filter to recent errors within the window
    const recentErrors = patterns.filter(p => p.timestamp >= cutoff);
    
    if (recentErrors.length >= threshold.count) {
      // Count unique users affected
      const uniqueUsers = new Set(recentErrors.map(e => e.userId));
      
      return {
        category,
        count: recentErrors.length,
        threshold: threshold.count,
        window: threshold.window,
        uniqueUsers: uniqueUsers.size,
        timespan: threshold.window / 1000 // in seconds
      };
    }
    
    return null;
  }
  
  /**
   * Handle threshold violation
   * @param {string} category - Error category
   * @param {Object} violation - Threshold violation details
   */
  async handleThresholdViolation(category, violation) {
    logger.warn('Error threshold exceeded', {
      category: violation.category,
      count: violation.count,
      threshold: violation.threshold,
      uniqueUsers: violation.uniqueUsers,
      timespan: violation.timespan
    });
    
    // In a production system, this might:
    // - Send alerts to monitoring systems
    // - Trigger automated responses
    // - Notify operations teams
    // - Update system health dashboards
  }
  
  /**
   * Get error statistics for a category
   * @param {string} category - Error category
   * @param {number} timeWindow - Time window in milliseconds
   * @returns {Object} - Error statistics
   */
  getErrorStats(category, timeWindow = 3600000) { // Default 1 hour
    const patterns = this.errorPatterns.get(category) || [];
    const cutoff = Date.now() - timeWindow;
    
    const recentErrors = patterns.filter(p => p.timestamp >= cutoff);
    
    // Count retry exhaustions
    const retryExhaustions = recentErrors.filter(p => p.retriesExhausted).length;
    
    // Group by operation
    const operationCounts = recentErrors.reduce((counts, error) => {
      counts[error.operation] = (counts[error.operation] || 0) + 1;
      return counts;
    }, {});
    
    return {
      category,
      total: recentErrors.length,
      uniqueUsers: new Set(recentErrors.map(e => e.userId)).size,
      timeWindow,
      retryExhaustions,
      operationCounts,
      errorRate: recentErrors.length / (timeWindow / 60000), // errors per minute
      oldestError: recentErrors.length > 0 ? 
        Math.min(...recentErrors.map(e => e.timestamp)) : null,
      newestError: recentErrors.length > 0 ? 
        Math.max(...recentErrors.map(e => e.timestamp)) : null
    };
  }
  
  /**
   * Get overall system health based on error patterns
   * @returns {Object} - System health summary
   */
  getSystemHealth() {
    const now = Date.now();
    const oneHour = 3600000;
    
    let totalErrors = 0;
    let criticalErrors = 0;
    const categoryStats = {};
    
    for (const [category, patterns] of this.errorPatterns.entries()) {
      const recentErrors = patterns.filter(p => p.timestamp >= now - oneHour);
      totalErrors += recentErrors.length;
      
      categoryStats[category] = recentErrors.length;
      
      // Critical categories
      if (['CLAUDE_ERROR', 'WHATSAPP_FAILURE', 'DB_ERROR', 'SYSTEM_ERROR'].includes(category)) {
        criticalErrors += recentErrors.length;
      }
    }
    
    // Simple health scoring
    let healthScore = 100;
    
    if (totalErrors > 50) healthScore -= 30;
    else if (totalErrors > 20) healthScore -= 15;
    else if (totalErrors > 10) healthScore -= 5;
    
    if (criticalErrors > 10) healthScore -= 40;
    else if (criticalErrors > 5) healthScore -= 20;
    else if (criticalErrors > 2) healthScore -= 10;
    
    const status = healthScore >= 90 ? 'healthy' :
                   healthScore >= 75 ? 'degraded' :
                   healthScore >= 50 ? 'unhealthy' : 'critical';
    
    return {
      status,
      score: Math.max(0, healthScore),
      totalErrors,
      criticalErrors,
      categoryStats,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Run all pattern detectors on the error data
   * @param {Object} errorRecord - Current error record
   * @param {Array} categoryPatterns - All errors in this category
   */
  async detectPatterns(errorRecord, categoryPatterns) {
    // Run each detector
    const detectionResults = await Promise.all([
      this.patternDetectors.frequency.detect(errorRecord, categoryPatterns),
      this.patternDetectors.userImpact.detect(errorRecord, categoryPatterns),
      this.patternDetectors.errorChain.detect(errorRecord),
      this.patternDetectors.timeCorrelation.detect(errorRecord, categoryPatterns)
    ]);
    
    // Filter out null results and handle detected patterns
    const patterns = detectionResults.filter(result => result !== null);
    
    for (const pattern of patterns) {
      await this.handleDetectedPattern(pattern);
    }
  }
  
  /**
   * Handle a detected error pattern
   * @param {Object} pattern - The detected pattern
   */
  async handleDetectedPattern(pattern) {
    // Log the pattern detection
    logger.warn(`Error pattern detected: ${pattern.type}`, {
      patternType: pattern.type,
      category: pattern.category,
      detectionMethod: pattern.detector,
      affectedUsers: pattern.affectedUsers,
      occurrences: pattern.occurrences,
      priority: pattern.priority,
      detectionTime: new Date().toISOString()
    });
    
    // Store the pattern
    this.detectedPatterns.push({
      ...pattern,
      detectedAt: Date.now()
    });
    
    // Limit stored patterns
    if (this.detectedPatterns.length > 100) {
      this.detectedPatterns = this.detectedPatterns.slice(-100);
    }
    
    // Send alert if appropriate
    if (this.shouldAlert(pattern)) {
      await this.sendAlert(pattern);
    }
  }
  
  /**
   * Determine if an alert should be sent
   * @param {Object} pattern - The detected pattern
   * @returns {boolean} - Whether to send an alert
   */
  shouldAlert(pattern) {
    const patternKey = `${pattern.type}:${pattern.category}`;
    const lastAlertTime = this.lastAlertTimes.get(patternKey) || 0;
    const alertWindow = this.thresholds[pattern.category]?.window || 300000;
    
    if (Date.now() - lastAlertTime < alertWindow) {
      return false;
    }
    
    this.lastAlertTimes.set(patternKey, Date.now());
    return true;
  }
  
  /**
   * Send an alert for a detected pattern
   * @param {Object} pattern - The detected pattern
   */
  async sendAlert(pattern) {
    logger.error(`ALERT: ${pattern.message}`, {
      type: 'ERROR_PATTERN_ALERT',
      pattern: pattern.type,
      category: pattern.category,
      priority: pattern.priority,
      affectedUsers: pattern.affectedUsers,
      message: pattern.message,
      recommendations: pattern.recommendations
    });
  }
  
  /**
   * Detect frequency-based patterns
   */
  detectFrequencyPattern(errorRecord, categoryErrors) {
    const { category } = errorRecord;
    const threshold = this.thresholds[category] || this.thresholds.UNKNOWN;
    
    if (!threshold) return null;
    
    const cutoff = Date.now() - threshold.window;
    const recentErrors = categoryErrors.filter(err => err.timestamp >= cutoff);
    
    if (recentErrors.length >= threshold.count) {
      const uniqueUsers = new Set(recentErrors.map(err => err.userId));
      
      return {
        type: 'FREQUENCY_THRESHOLD',
        detector: 'frequency',
        category,
        occurrences: recentErrors.length,
        window: threshold.window,
        threshold: threshold.count,
        affectedUsers: uniqueUsers.size,
        priority: threshold.priority || 'medium',
        message: `Error frequency threshold exceeded for ${category}: ${recentErrors.length} errors in ${threshold.window/1000} seconds`,
        recommendations: [
          'Check service health',
          'Review recent deployments',
          'Consider scaling resources',
          'Check external dependencies'
        ]
      };
    }
    
    return null;
  }
  
  /**
   * Detect patterns based on user impact
   */
  detectUserImpactPattern(errorRecord, categoryErrors) {
    const { category, userId } = errorRecord;
    const cutoff = Date.now() - 600000; // 10 minutes
    
    const userErrors = categoryErrors.filter(err => 
      err.userId === userId && err.timestamp >= cutoff
    );
    
    if (userErrors.length >= 5) {
      return {
        type: 'USER_IMPACT',
        detector: 'userImpact',
        category,
        userId,
        occurrences: userErrors.length,
        affectedUsers: 1,
        priority: 'high',
        message: `User ${userId} experiencing repeated errors: ${userErrors.length} ${category} errors in 10 minutes`,
        recommendations: [
          'Check user session state',
          'Review user input patterns',
          'Consider reaching out to the user',
          'Check for account-specific issues'
        ]
      };
    }
    
    return null;
  }
  
  /**
   * Detect error chains across categories
   */
  detectErrorChainPattern(errorRecord) {
    const { userId, timestamp, category: currentCategory } = errorRecord;
    const timeWindow = 60000; // 1 minute
    const relatedErrors = [];
    
    for (const [category, errors] of this.errorPatterns.entries()) {
      const userCategoryErrors = errors.filter(err => 
        err.userId === userId &&
        Math.abs(err.timestamp - timestamp) < timeWindow &&
        err.errorId !== errorRecord.errorId
      );
      
      relatedErrors.push(...userCategoryErrors.map(err => ({
        ...err,
        category
      })));
    }
    
    // Include the current error's category
    const uniqueCategories = new Set([currentCategory, ...relatedErrors.map(err => err.category)]);
    if (uniqueCategories.size >= 3) {
      return {
        type: 'ERROR_CHAIN',
        detector: 'errorChain',
        category: 'MULTIPLE',
        userId,
        occurrences: relatedErrors.length,
        categories: Array.from(uniqueCategories),
        affectedUsers: 1,
        priority: 'high',
        message: `Error chain detected for user ${userId}: ${relatedErrors.length} errors across ${uniqueCategories.size} categories`,
        recommendations: [
          'Check for cascading failures',
          'Review user session integrity',
          'Check system dependencies',
          'Consider circuit breaker activation'
        ]
      };
    }
    
    return null;
  }
  
  /**
   * Detect time-based correlation patterns
   */
  detectTimeCorrelationPattern(errorRecord, categoryErrors) {
    // Simple implementation: detect if errors cluster at specific times
    if (categoryErrors.length < 10) return null; // Need enough data
    
    const { category } = errorRecord;
    const hourCounts = new Map();
    
    categoryErrors.forEach(err => {
      const hour = new Date(err.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    
    // Find hours with significantly more errors
    const avgCount = categoryErrors.length / 24;
    const threshold = Math.max(5, avgCount * 3);
    
    for (const [hour, count] of hourCounts.entries()) {
      if (count >= threshold) {
        return {
          type: 'TIME_CORRELATION',
          detector: 'timeCorrelation',
          category,
          hour,
          occurrences: count,
          affectedUsers: 'multiple',
          priority: 'medium',
          message: `Time-based pattern detected for ${category}: ${count} errors frequently occur at ${hour}:00`,
          recommendations: [
            'Check for scheduled jobs at this time',
            'Review system load patterns',
            'Check for batch processing issues',
            'Consider load distribution'
          ]
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get recent detected patterns
   * @param {number} limit - Maximum patterns to return
   * @returns {Array} - Recent patterns
   */
  getRecentPatterns(limit = 10) {
    return this.detectedPatterns
      .slice(-limit)
      .reverse();
  }
  
  /**
   * Start periodic cleanup of old error records
   */
  startCleanupTask() {
    // Clean up every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldErrors();
    }, 600000);
  }
  
  /**
   * Remove old error records to prevent memory leaks
   */
  cleanupOldErrors() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = now - maxAge;
    let cleanedCount = 0;
    
    for (const [category, patterns] of this.errorPatterns.entries()) {
      const oldLength = patterns.length;
      const recentPatterns = patterns.filter(p => p.timestamp >= cutoff);
      this.errorPatterns.set(category, recentPatterns);
      cleanedCount += oldLength - recentPatterns.length;
    }
    
    // Also clean old detected patterns
    const patternCutoff = now - maxAge;
    const oldPatternCount = this.detectedPatterns.length;
    this.detectedPatterns = this.detectedPatterns.filter(p => p.detectedAt >= patternCutoff);
    cleanedCount += oldPatternCount - this.detectedPatterns.length;
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old error records`);
    }
  }
  
  /**
   * Stop cleanup task (useful for testing)
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Reset state (for testing)
   */
  resetState() {
    this.errorPatterns.clear();
    this.detectedPatterns = [];
    this.lastAlertTimes.clear();
  }
}

// Export singleton instance
module.exports = new ErrorMonitoringService();