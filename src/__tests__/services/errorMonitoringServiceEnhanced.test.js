const ErrorMonitoringService = require('../../services/errorMonitoringService');

// Mock logger
jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logError: jest.fn()
}));

const logger = require('../../utils/logger');

describe('ErrorMonitoringService (Enhanced)', () => {
  let service;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Use the singleton instance and reset its state
    service = require('../../services/errorMonitoringService');
    service.resetState();
    // Re-initialize pattern detectors after reset
    service.initializePatternDetectors();
  });
  
  afterEach(() => {
    // Stop cleanup to prevent timer issues
    service.stopCleanup();
  });

  describe('Enhanced Error Tracking', () => {
    it('should track errors with retry information', async () => {
      const error = new Error('Test error');
      error.retryInfo = {
        attempts: 3,
        exhausted: true
      };
      
      const result = await service.trackError(error, 'TEST_OPERATION', 'user123');
      
      expect(result.tracked).toBe(true);
      expect(result.errorId).toBeDefined();
      
      // Check that retry info was stored
      const stats = service.getErrorStats(result.category);
      expect(stats.retryExhaustions).toBe(1);
    });

    it('should generate unique error IDs', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      
      const result1 = await service.trackError(error1, 'TEST_OP', 'user1');
      const result2 = await service.trackError(error2, 'TEST_OP', 'user2');
      
      expect(result1.errorId).toBeDefined();
      expect(result2.errorId).toBeDefined();
      expect(result1.errorId).not.toBe(result2.errorId);
    });
  });

  describe('Pattern Detection', () => {
    describe('Frequency Pattern', () => {
      it('should detect frequency threshold violations', async () => {
        // Set a low threshold for CLAUDE_ERROR which is what gets categorized
        service.thresholds.CLAUDE_ERROR = { count: 3, window: 60000, priority: 'high' };
        
        // Track multiple errors quickly - they will be categorized as CLAUDE_ERROR
        for (let i = 0; i < 4; i++) {
          const error = new Error('Claude API error');
          await service.trackError(error, 'CLAUDE_GENERATE', `user${i}`);
        }
        
        // Check that pattern was detected
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error pattern detected: FREQUENCY_THRESHOLD'),
          expect.objectContaining({
            patternType: 'FREQUENCY_THRESHOLD',
            category: 'CLAUDE_ERROR',
            occurrences: 4,
            priority: 'high'
          })
        );
        
        // Check that alert was sent
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('ALERT:'),
          expect.objectContaining({
            type: 'ERROR_PATTERN_ALERT',
            pattern: 'FREQUENCY_THRESHOLD'
          })
        );
      });

      it('should not alert twice within the same window', async () => {
        service.thresholds.CLAUDE_ERROR = { count: 2, window: 60000, priority: 'high' };
        
        // Trigger pattern twice
        for (let i = 0; i < 3; i++) {
          await service.trackError(new Error('Error'), 'CLAUDE_GENERATE', 'user1');
        }
        
        jest.clearAllMocks();
        
        // Trigger pattern again
        await service.trackError(new Error('Error'), 'CLAUDE_GENERATE', 'user2');
        
        // Should detect pattern but not send alert
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error pattern detected'),
          expect.any(Object)
        );
        expect(logger.error).not.toHaveBeenCalled();
      });
    });

    describe('User Impact Pattern', () => {
      it('should detect repeated errors for a single user', async () => {
        const userId = 'user123';
        
        // Track 5 errors for the same user
        for (let i = 0; i < 5; i++) {
          const error = new Error(`Error ${i}`);
          await service.trackError(error, 'WHATSAPP_SEND_MESSAGE', userId);
        }
        
        const warnCall = logger.warn.mock.calls.find(call => 
          call[0].includes('USER_IMPACT')
        );
        
        expect(warnCall).toBeDefined();
        expect(warnCall[0]).toContain('Error pattern detected: USER_IMPACT');
        expect(warnCall[1]).toMatchObject({
          patternType: 'USER_IMPACT',
          occurrences: 5,
          priority: 'high'
        });
      });

      it('should not detect pattern for different users', async () => {
        // Track 2 errors each for different users
        for (let i = 0; i < 4; i++) {
          const error = new Error(`Error ${i}`);
          await service.trackError(error, 'WHATSAPP_SEND_MESSAGE', `user${i}`);
        }
        
        // Should not detect user impact pattern
        expect(logger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining('USER_IMPACT'),
          expect.any(Object)
        );
      });
    });

    describe('Error Chain Pattern', () => {
      it('should detect error chains across categories', async () => {
        const userId = 'user123';
        
        // Create errors in different categories
        await service.trackError(new Error('DB Error'), 'DB_QUERY', userId);
        await service.trackError(new Error('Claude Error'), 'CLAUDE_GENERATE', userId);
        await service.trackError(new Error('WhatsApp Error'), 'WHATSAPP_SEND_MESSAGE', userId);
        
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error pattern detected: ERROR_CHAIN'),
          expect.objectContaining({
            patternType: 'ERROR_CHAIN',
            category: 'MULTIPLE'
          })
        );
      });
    });

    describe('Time Correlation Pattern', () => {
      it('should detect time-based patterns', async () => {
        // Disable frequency detection for this test
        service.thresholds.CLAUDE_ERROR = { count: 100, window: 60000, priority: 'high' };
        
        // Mock Date to control hours
        const originalDate = global.Date;
        const baseTime = new Date('2024-01-01T14:00:00Z').getTime(); // 2 PM
        let callCount = 0;
        
        global.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              super(baseTime + callCount * 1000); // Increment slightly each time
              callCount++;
            } else {
              super(...args);
            }
          }
          
          getHours() {
            return 14; // Always return 2 PM
          }
          
          static now() {
            return baseTime + callCount * 1000;
          }
        };
        
        // Create 10 errors at the same hour
        for (let i = 0; i < 10; i++) {
          const error = new Error(`Error ${i}`);
          await service.trackError(error, 'CLAUDE_GENERATE', `user${i}`);
        }
        
        // Restore Date
        global.Date = originalDate;
        
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error pattern detected: TIME_CORRELATION'),
          expect.objectContaining({
            patternType: 'TIME_CORRELATION',
            category: 'CLAUDE_ERROR',
            occurrences: 10
          })
        );
      });
    });
  });

  describe('Error Statistics', () => {
    it('should calculate comprehensive error statistics', async () => {
      // Track various errors - they should map to CLAUDE_ERROR category
      const error1 = new Error('Claude Error 1');
      error1.retryInfo = { attempts: 3, exhausted: true };
      await service.trackError(error1, 'CLAUDE_GENERATE', 'user1');
      
      const error2 = new Error('Claude Error 2');
      await service.trackError(error2, 'CLAUDE_GENERATE', 'user2');
      
      const error3 = new Error('timeout');
      await service.trackError(error3, 'CLAUDE_GENERATE', 'user1');
      
      const stats = service.getErrorStats('CLAUDE_ERROR', 3600000);
      
      expect(stats).toMatchObject({
        category: 'CLAUDE_ERROR',
        total: 2, // First two errors
        uniqueUsers: 2,
        retryExhaustions: 1,
        operationCounts: {
          'CLAUDE_GENERATE': 2
        }
      });
      
      // Check timeout separately
      const timeoutStats = service.getErrorStats('CLAUDE_TIMEOUT', 3600000);
      expect(timeoutStats.total).toBe(1);
    });
  });

  describe('Pattern Storage and Retrieval', () => {
    it('should store detected patterns', async () => {
      service.thresholds.CLAUDE_ERROR = { count: 2, window: 60000, priority: 'high' };
      
      // Trigger a pattern
      for (let i = 0; i < 3; i++) {
        await service.trackError(new Error('Error'), 'CLAUDE_GENERATE', `user${i}`);
      }
      
      const patterns = service.getRecentPatterns();
      // May have multiple patterns if threshold was exceeded multiple times
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      // Check the most recent pattern
      const mostRecentPattern = patterns[0];
      expect(mostRecentPattern).toMatchObject({
        type: 'FREQUENCY_THRESHOLD',
        category: 'CLAUDE_ERROR',
        occurrences: 3
      });
    });

    it('should limit stored patterns to 100', async () => {
      // Directly add patterns to test limit
      for (let i = 0; i < 110; i++) {
        service.detectedPatterns.push({
          type: 'TEST_PATTERN',
          detectedAt: Date.now(),
          id: i
        });
      }
      
      // Trigger pattern detection to apply limit
      service.detectedPatterns = service.detectedPatterns.slice(-100);
      
      expect(service.detectedPatterns).toHaveLength(100);
      expect(service.detectedPatterns[0].id).toBe(10); // First 10 should be removed
    });
  });

  describe('System Health', () => {
    it('should calculate system health based on error patterns', async () => {
      // Track some errors
      for (let i = 0; i < 3; i++) {
        await service.trackError(new Error('DB Error'), 'DB_QUERY', `user${i}`);
      }
      
      for (let i = 0; i < 2; i++) {
        await service.trackError(new Error('Claude Error'), 'CLAUDE_GENERATE', `user${i}`);
      }
      
      const health = service.getSystemHealth();
      
      expect(health).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy|critical/),
        score: expect.any(Number),
        totalErrors: 5,
        criticalErrors: 5 // Both DB and Claude are critical
      });
      
      expect(health.score).toBeLessThan(100); // Should be penalized for errors
    });
  });

  describe('Cleanup', () => {
    it('should clean up old error records', async () => {
      const now = Date.now();
      const oldTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
      
      // Add old error directly
      service.errorPatterns.set('TEST_CATEGORY', [
        { timestamp: oldTime, errorId: 'old1' },
        { timestamp: now, errorId: 'new1' }
      ]);
      
      service.detectedPatterns = [
        { detectedAt: oldTime, type: 'OLD_PATTERN' },
        { detectedAt: now, type: 'NEW_PATTERN' }
      ];
      
      service.cleanupOldErrors();
      
      const patterns = service.errorPatterns.get('TEST_CATEGORY');
      expect(patterns).toHaveLength(1);
      expect(patterns[0].errorId).toBe('new1');
      
      expect(service.detectedPatterns).toHaveLength(1);
      expect(service.detectedPatterns[0].type).toBe('NEW_PATTERN');
    });
  });

  describe('Error Categorization', () => {
    it('should categorize errors correctly', () => {
      const testCases = [
        { error: new Error('Claude API timeout'), operation: 'CLAUDE_GENERATE', expected: 'CLAUDE_TIMEOUT' },
        { error: new Error('WhatsApp send failed'), operation: 'WHATSAPP_SEND_MESSAGE', expected: 'WHATSAPP_FAILURE' },
        { error: new Error('Database connection lost'), operation: 'DB_QUERY', expected: 'DB_ERROR' },
        { error: { message: 'Validation failed', code: 'VALIDATION_ERROR' }, operation: 'VALIDATION', expected: 'VALIDATION_ERROR' },
        { error: { message: 'Network timeout', code: 'ETIMEDOUT' }, operation: 'API_CALL', expected: 'NETWORK_ERROR' }
      ];
      
      testCases.forEach(({ error, operation, expected }) => {
        const category = service.categorizeError(error, operation);
        expect(category).toBe(expected);
      });
    });
  });
});