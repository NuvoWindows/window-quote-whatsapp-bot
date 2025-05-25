const errorMonitoringService = require('../../services/errorMonitoringService');

// Mock dependencies
jest.mock('../../utils/logger');
const logger = require('../../utils/logger');

describe('ErrorMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger methods
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();
    logger.logError = jest.fn();

    // Clear error patterns by accessing the internal state
    errorMonitoringService.errorPatterns.clear();
  });

  describe('trackError', () => {
    test('should track basic error information and return tracking result', async () => {
      const error = new Error('Test error message');
      const operation = 'test_operation';
      const userId = 'test-user';

      const result = await errorMonitoringService.trackError(error, operation, userId);

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('tracked');
      expect(result).toHaveProperty('errorId');
      expect(result.tracked).toBe(true);
      expect(result.errorId).toMatch(/^err_/);
    });

    test('should categorize errors correctly', async () => {
      const testCases = [
        { error: new Error('timeout'), operation: 'CLAUDE_operation', expectedCategory: 'CLAUDE_TIMEOUT' },
        { error: new Error('network timeout'), operation: 'network_op', expectedCategory: 'NETWORK_ERROR' },
        { error: new Error('database connection failed'), operation: 'db_op', expectedCategory: 'DB_ERROR' },
        { error: new Error('rate limit'), operation: 'api_call', expectedCategory: 'RATE_LIMIT_ERROR' },
        { error: new Error('parsing failed'), operation: 'PARSING_data', expectedCategory: 'PARSING_ERROR' },
        { error: new Error('validation failed'), operation: 'VALIDATION_check', expectedCategory: 'VALIDATION_ERROR' },
        { error: new Error('whatsapp failed'), operation: 'WHATSAPP_send', expectedCategory: 'WHATSAPP_FAILURE' },
        { error: new Error('claude failed'), operation: 'CLAUDE_request', expectedCategory: 'CLAUDE_ERROR' }
      ];

      for (const testCase of testCases) {
        const result = await errorMonitoringService.trackError(testCase.error, testCase.operation, 'user');
        expect(result.category).toBe(testCase.expectedCategory);
      }
    });

    test.skip('should detect threshold violations', async () => {
      const error = new Error('Threshold test error');
      
      // Generate enough CLAUDE_ERRORs to trigger threshold (5 errors in 5 minutes)
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(errorMonitoringService.trackError(error, 'CLAUDE_request', `user-${i}`));
      }
      const results = await Promise.all(promises);

      // The last error should trigger a threshold violation
      const lastResult = results[results.length - 1];
      expect(lastResult.thresholdViolation).toBe(true);
    });

    test('should handle tracking errors gracefully', async () => {
      // Pass error with null message to test error handling
      const nullError = { message: null, constructor: { name: 'NullError' } };
      const result = await errorMonitoringService.trackError(nullError, 'test', 'user');

      expect(result.tracked).toBe(false);
      expect(result).toHaveProperty('error');
      expect(result.category).toBe('UNKNOWN');
    });
  });

  describe('getErrorStats', () => {
    test('should return error statistics for a category', async () => {
      const error = new Error('Network error');
      await errorMonitoringService.trackError(error, 'network_operation', 'user1');
      await errorMonitoringService.trackError(error, 'network_operation', 'user2');

      const stats = errorMonitoringService.getErrorStats('SYSTEM_ERROR');

      expect(stats).toHaveProperty('category');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats).toHaveProperty('timeWindow');
      expect(stats).toHaveProperty('oldestError');
      expect(stats).toHaveProperty('newestError');
    });

    test('should calculate unique users correctly', async () => {
      const error = new Error('Test error');
      
      // Track errors for same user multiple times
      await errorMonitoringService.trackError(error, 'test_op', 'user1');
      await errorMonitoringService.trackError(error, 'test_op', 'user1');
      await errorMonitoringService.trackError(error, 'test_op', 'user2');

      const stats = errorMonitoringService.getErrorStats('SYSTEM_ERROR');
      expect(stats.total).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
    });

    test('should handle empty category gracefully', () => {
      const stats = errorMonitoringService.getErrorStats('NON_EXISTENT_CATEGORY');
      
      expect(stats.total).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.oldestError).toBeNull();
      expect(stats.newestError).toBeNull();
    });
  });

  describe('getSystemHealth', () => {
    test('should return system health summary', async () => {
      // Generate some errors
      await errorMonitoringService.trackError(new Error('Network error'), 'network_op', 'user1');
      await errorMonitoringService.trackError(new Error('Claude error'), 'CLAUDE_request', 'user2');

      const health = errorMonitoringService.getSystemHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('score');
      expect(health).toHaveProperty('totalErrors');
      expect(health).toHaveProperty('criticalErrors');
      expect(health).toHaveProperty('categoryStats');
      expect(health).toHaveProperty('timestamp');
      
      expect(['healthy', 'degraded', 'unhealthy', 'critical']).toContain(health.status);
      expect(typeof health.score).toBe('number');
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
    });

    test('should calculate health score based on error volume', async () => {
      // Generate many errors to test health scoring
      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(errorMonitoringService.trackError(
          new Error(`Error ${i}`), 
          'test_operation', 
          `user-${i}`
        ));
      }
      await Promise.all(promises);

      const health = errorMonitoringService.getSystemHealth();
      
      // With 25 total errors, health score should be reduced
      expect(health.score).toBeLessThan(100);
      expect(health.totalErrors).toBe(25);
    });

    test('should identify critical errors correctly', async () => {
      // Generate critical errors
      await errorMonitoringService.trackError(new Error('DB error'), 'database_op', 'user1');
      await errorMonitoringService.trackError(new Error('Claude error'), 'CLAUDE_request', 'user2');
      await errorMonitoringService.trackError(new Error('WhatsApp error'), 'WHATSAPP_send', 'user3');

      const health = errorMonitoringService.getSystemHealth();
      
      expect(health.criticalErrors).toBeGreaterThan(0);
    });
  });

  describe('categorizeError', () => {
    test('should categorize timeout errors correctly', () => {
      const timeoutError = new Error('ETIMEDOUT');
      timeoutError.code = 'ETIMEDOUT';
      
      const category = errorMonitoringService.categorizeError(timeoutError, 'CLAUDE_request');
      expect(category).toBe('CLAUDE_TIMEOUT');
    });

    test('should categorize rate limit errors', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      
      const category = errorMonitoringService.categorizeError(rateLimitError, 'api_call');
      expect(category).toBe('RATE_LIMIT_ERROR');
    });

    test('should categorize database errors', () => {
      const dbError = new Error('database connection failed');
      
      const category = errorMonitoringService.categorizeError(dbError, 'save_data');
      expect(category).toBe('DB_ERROR');
    });

    test('should fall back to operation-based categorization', () => {
      const genericError = new Error('Generic error');
      
      expect(errorMonitoringService.categorizeError(genericError, 'CLAUDE_request')).toBe('CLAUDE_ERROR');
      expect(errorMonitoringService.categorizeError(genericError, 'WHATSAPP_send')).toBe('WHATSAPP_FAILURE');
      expect(errorMonitoringService.categorizeError(genericError, 'PARSING_data')).toBe('PARSING_ERROR');
      expect(errorMonitoringService.categorizeError(genericError, 'VALIDATION_check')).toBe('VALIDATION_ERROR');
    });

    test('should use system error as default', () => {
      const unknownError = new Error('Unknown error');
      
      const category = errorMonitoringService.categorizeError(unknownError, 'unknown_operation');
      expect(category).toBe('SYSTEM_ERROR');
    });
  });

  describe('checkThresholds', () => {
    test('should return null when no threshold is configured', () => {
      const result = errorMonitoringService.checkThresholds('UNKNOWN_CATEGORY', []);
      expect(result).toBeNull();
    });

    test('should return null when threshold is not exceeded', () => {
      const patterns = [
        { timestamp: Date.now(), userId: 'user1' },
        { timestamp: Date.now() - 1000, userId: 'user2' }
      ];
      
      const result = errorMonitoringService.checkThresholds('CLAUDE_ERROR', patterns);
      expect(result).toBeNull();
    });

    test('should return violation info when threshold is exceeded', () => {
      const now = Date.now();
      const patterns = [];
      
      // Create 6 errors (threshold is 5) within the time window
      for (let i = 0; i < 6; i++) {
        patterns.push({
          timestamp: now - i * 1000,
          userId: `user-${i}`
        });
      }
      
      const result = errorMonitoringService.checkThresholds('CLAUDE_ERROR', patterns);
      
      expect(result).not.toBeNull();
      expect(result.category).toBe('CLAUDE_ERROR');
      expect(result.count).toBe(6);
      expect(result.threshold).toBe(5);
      expect(result.uniqueUsers).toBe(6);
    });
  });

  describe('memory management', () => {
    test('should clean up old errors', () => {
      // Add some old error data directly to test cleanup
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      
      errorMonitoringService.errorPatterns.set('TEST_CATEGORY', [
        { timestamp: oldTimestamp, userId: 'user1' },
        { timestamp: recentTimestamp, userId: 'user2' }
      ]);
      
      errorMonitoringService.cleanupOldErrors();
      
      const remainingPatterns = errorMonitoringService.errorPatterns.get('TEST_CATEGORY');
      expect(remainingPatterns.length).toBe(1);
      expect(remainingPatterns[0].timestamp).toBe(recentTimestamp);
    });

    test('should handle concurrent error tracking without data corruption', async () => {
      // Generate concurrent errors
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(errorMonitoringService.trackError(
          new Error(`Concurrent error ${i}`),
          'concurrent_operation',
          `user-${i}`
        ));
      }

      const results = await Promise.all(promises);
      
      // All should be tracked successfully
      expect(results.every(r => r.tracked)).toBe(true);
      
      const stats = errorMonitoringService.getErrorStats('SYSTEM_ERROR');
      expect(stats.total).toBe(50);
    });
  });

  describe('integration scenarios', () => {
    test('should handle realistic error monitoring workflow', async () => {
      // Simulate various types of errors that might occur in the application
      const errorScenarios = [
        { error: new Error('Connection timeout'), operation: 'CLAUDE_request', users: ['user1', 'user2'] },
        { error: new Error('database connection failed'), operation: 'save_conversation', users: ['user3'] },
        { error: new Error('Invalid window spec'), operation: 'VALIDATION_specs', users: ['user1'] },
        { error: new Error('WhatsApp API error'), operation: 'WHATSAPP_send', users: ['user4', 'user5'] }
      ];

      let totalErrors = 0;
      for (const scenario of errorScenarios) {
        for (const user of scenario.users) {
          await errorMonitoringService.trackError(scenario.error, scenario.operation, user);
          totalErrors++;
        }
      }

      // Check overall system health
      const health = errorMonitoringService.getSystemHealth();
      expect(health.totalErrors).toBe(totalErrors);
      expect(health.categoryStats).toHaveProperty('CLAUDE_TIMEOUT');
      expect(health.categoryStats).toHaveProperty('DB_ERROR');
      expect(health.categoryStats).toHaveProperty('VALIDATION_ERROR');
      expect(health.categoryStats).toHaveProperty('WHATSAPP_FAILURE');
      
      // Check category-specific stats
      const claudeStats = errorMonitoringService.getErrorStats('CLAUDE_TIMEOUT');
      expect(claudeStats.total).toBe(2);
      expect(claudeStats.uniqueUsers).toBe(2);
      
      const dbStats = errorMonitoringService.getErrorStats('DB_ERROR');
      expect(dbStats.total).toBe(1);
      expect(dbStats.uniqueUsers).toBe(1);
    });
  });
});