const ErrorRecoveryService = require('../../services/errorRecoveryService');

// Mock dependencies
jest.mock('../../services/conversationManager');
jest.mock('../../utils/logger');

const conversationManager = require('../../services/conversationManager');
const logger = require('../../utils/logger');

describe('ErrorRecoveryService', () => {
  let service;
  let mockErrorContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock dependencies
    conversationManager.addMessage = jest.fn().mockResolvedValue();
    conversationManager.getConversationContext = jest.fn().mockResolvedValue([]);
    conversationManager.savePartialSpecification = jest.fn().mockResolvedValue();
    conversationManager.setConversationContext = jest.fn().mockResolvedValue();
    
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.logError = jest.fn();

    // Mock ErrorContextService
    mockErrorContextService = {
      captureErrorContext: jest.fn().mockResolvedValue({
        errorId: 'test-error-id',
        conversationPhase: 'SPECIFICATION_GATHERING',
        lastUserMessage: 'Test message',
        partialSpecifications: { width: '48' }
      })
    };

    service = new ErrorRecoveryService(conversationManager, mockErrorContextService);
  });

  describe('handleError', () => {
    test('should handle network errors with retry strategy', async () => {
      const userId = 'test-user';
      const error = new Error('ENOTFOUND api.anthropic.com');
      error.code = 'ETIMEDOUT';
      const operation = 'NETWORK_OPERATION';
      const context = {
        errorDetails: { category: 'network' },
        conversationState: { messageCount: 3 }
      };

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('network_error_retry');
      expect(result.successful).toBe(true);
      expect(result.message).toContain('connectivity');
      expect(result.actions).toBeDefined();
    });

    test('should handle timeout errors with context preservation', async () => {
      const userId = 'test-user';
      const error = new Error('Request timeout after 30000ms');
      const operation = 'CLAUDE_API_CALL';
      const context = {
        errorDetails: { category: 'timeout' },
        conversationState: { 
          messageCount: 5,
          specificationProgress: { operation_type: 'casement', width: '48' }
        }
      };

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('claude_timeout_retry');
      expect(result.successful).toBe(true);
      expect(result.message).toContain('try again');
      expect(conversationManager.savePartialSpecification).toHaveBeenCalled();
    });

    test('should handle validation errors with clarification request', async () => {
      const userId = 'test-user';
      const error = new Error('Invalid dimensions: width must be a positive number');
      const operation = 'VALIDATION_CHECK';
      const context = {
        errorDetails: { category: 'validation' },
        conversationState: { 
          lastUserMessage: 'width is abc inches',
          specificationProgress: { operation_type: 'casement' }
        }
      };

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('validation_error_guidance');
      expect(result.successful).toBe(true);
      expect(result.message).toContain('information provided');
      expect(result.actions.provideGuidance).toBe(true);
    });

    test('should handle database errors with data preservation', async () => {
      const userId = 'test-user';
      const error = new Error('SQLITE_BUSY: database is locked');
      const operation = 'DB_SAVE';
      const context = {
        errorDetails: { category: 'database' },
        conversationState: { messageCount: 7 }
      };

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('database_error_fallback');
      expect(result.successful).toBe(true);
      expect(result.message).toContain('technical issue');
    });

    test('should handle parsing errors with clarification', async () => {
      const userId = 'test-user';
      const error = new Error('Failed to parse user input');
      const operation = 'PARSING_USER_INPUT';
      const context = {};

      mockErrorContextService.captureErrorContext.mockResolvedValue({
        errorId: 'test-error-id',
        conversationPhase: 'AWAITING_USER_RESPONSE',
        lastUserMessage: 'unclear message'
      });

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('parsing_error_clarification');
      expect(result.successful).toBe(true);
      expect(result.message).toContain("didn't quite catch");
    });

    test('should handle unknown errors with default recovery', async () => {
      const userId = 'test-user';
      const error = new Error('Something unexpected happened');
      const operation = 'UNKNOWN_OPERATION';
      const context = {
        errorDetails: { category: 'unknown' },
        conversationState: { messageCount: 2 }
      };

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('default_recovery');
      expect(result.successful).toBe(true);
      expect(result.message).toContain('unexpected issue');
    });

    test('should use last resort recovery when error context service fails', async () => {
      const userId = 'test-user';
      const error = new Error('Critical system failure');
      const operation = 'SYSTEM_CRITICAL';
      const context = {};

      mockErrorContextService.captureErrorContext.mockRejectedValue(new Error('Context service failed'));

      const result = await service.handleError(userId, error, operation, context);

      expect(result.strategy).toBe('last_resort');
      expect(result.successful).toBe(false);
      expect(result.message).toContain('technical difficulties');
    });
  });

  describe('getRecoveryStrategy', () => {
    test('should select appropriate strategy based on error characteristics', () => {
      const strategies = [
        { error: new Error('ETIMEDOUT'), operation: 'CLAUDE_API', expected: 'CLAUDE_TIMEOUT' },
        { error: new Error('timeout'), operation: 'NETWORK_OP', expected: 'NETWORK_ERROR' },
        { error: { status: 429, message: 'Rate limit exceeded' }, operation: 'API_CALL', expected: 'RATE_LIMIT_ERROR' },
        { error: new Error('database connection'), operation: 'DB_OP', expected: 'DB_CONNECTION_LOST' },
        { error: new Error('parsing failed'), operation: 'PARSING_INPUT', expected: 'PARSING_ERROR' }
      ];

      strategies.forEach(({ error, operation, expected }) => {
        const strategy = service.getRecoveryStrategy(error, operation);
        expect(strategy).toBeDefined();
        expect(typeof strategy).toBe('function');
      });
    });

    test('should return null for unmatched errors', () => {
      const error = new Error('Unknown error');
      const operation = 'UNKNOWN_OPERATION';
      
      const strategy = service.getRecoveryStrategy(error, operation);
      expect(strategy).toBeNull();
    });
  });

  describe('specific recovery methods', () => {
    describe('recoverFromClaudeTimeout', () => {
      test('should preserve conversation state and suggest retry', async () => {
        const userId = 'test-user';
        const context = {
          lastUserMessage: 'Test message',
          partialSpecifications: { operation_type: 'casement', width: '48' }
        };

        const result = await service.recoverFromClaudeTimeout(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('claude_timeout_retry');
        expect(result.message).toContain('try again');
        expect(result.actions.retry).toBe(true);
        expect(conversationManager.savePartialSpecification).toHaveBeenCalledWith(
          userId, context.partialSpecifications
        );
      });
    });

    describe('recoverFromClaudeError', () => {
      test('should provide fallback message', async () => {
        const userId = 'test-user';
        const context = {
          conversationPhase: 'SPECIFICATION_GATHERING'
        };

        const result = await service.recoverFromClaudeError(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('claude_error_fallback');
        expect(result.message).toBeDefined();
        expect(result.actions.useFallback).toBe(true);
      });

      test('should delegate to rate limit recovery for 429 errors', async () => {
        const userId = 'test-user';
        const context = {
          errorCode: 429
        };

        const result = await service.recoverFromClaudeError(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('rate_limit_delay');
      });
    });

    describe('recoverFromWhatsAppFailure', () => {
      test('should queue message for retry', async () => {
        const userId = 'test-user';
        const context = {
          pendingOperation: {
            messageContent: 'Test message to send'
          }
        };

        const result = await service.recoverFromWhatsAppFailure(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('whatsapp_failure_queue');
        expect(result.actions.queueForRetry).toBe(true);
        expect(conversationManager.setConversationContext).toHaveBeenCalled();
      });
    });

    describe('recoverFromParsingError', () => {
      test('should request clarification during user response phase', async () => {
        const userId = 'test-user';
        const context = {
          conversationPhase: 'AWAITING_USER_RESPONSE'
        };

        const result = await service.recoverFromParsingError(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('parsing_error_clarification');
        expect(result.message).toContain("didn't quite catch");
        expect(result.actions.requestClarification).toBe(true);
      });

      test('should reset to safe state for other phases', async () => {
        const userId = 'test-user';
        const context = {
          conversationPhase: 'OTHER_PHASE'
        };

        const result = await service.recoverFromParsingError(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('parsing_error_reset');
        expect(result.message).toContain("try again");
        expect(result.actions.resetToSafeState).toBe(true);
      });
    });

    describe('recoverFromRateLimitError', () => {
      test('should implement delay strategy', async () => {
        const userId = 'test-user';
        const context = {};

        const result = await service.recoverFromRateLimitError(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('rate_limit_delay');
        expect(result.message).toContain('moment');
        expect(result.actions.retryAfterDelay).toBe(5000);
      });
    });
  });

  describe('fallback methods', () => {
    describe('defaultRecovery', () => {
      test('should preserve state and provide generic recovery', async () => {
        const userId = 'test-user';
        const context = {
          partialSpecifications: { width: '48' }
        };

        const result = await service.defaultRecovery(userId, context);

        expect(result.successful).toBe(true);
        expect(result.strategy).toBe('default_recovery');
        expect(result.message).toContain('unexpected issue');
        expect(conversationManager.savePartialSpecification).toHaveBeenCalled();
      });
    });

    describe('lastResortRecovery', () => {
      test('should return unsuccessful result with support notification', () => {
        const userId = 'test-user';
        const error = new Error('Critical failure');

        const result = service.lastResortRecovery(userId, error);

        expect(result.successful).toBe(false);
        expect(result.strategy).toBe('last_resort');
        expect(result.message).toContain('technical difficulties');
        expect(result.actions.notifySupport).toBe(true);
      });
    });
  });

  describe('helper methods', () => {
    describe('generateClaudeFallbackMessage', () => {
      test('should generate appropriate message for different phases', () => {
        const phases = [
          { phase: 'INITIAL_GREETING', expected: 'Hello!' },
          { phase: 'SPECIFICATION_GATHERING', expected: 'window quote' },
          { phase: 'AWAITING_USER_RESPONSE', expected: 'try again' },
          { phase: 'OTHER_PHASE', expected: 'apologize' }
        ];

        phases.forEach(({ phase, expected }) => {
          const context = { conversationPhase: phase };
          const message = service.generateClaudeFallbackMessage(context);
          expect(message).toContain(expected);
        });
      });
    });

    describe('extractCriticalData', () => {
      test('should extract important conversation data', () => {
        const context = {
          partialSpecifications: { width: '48', height: '36' },
          conversationPhase: 'SPECIFICATION_GATHERING',
          lastUserMessage: 'Test message'
        };

        const criticalData = service.extractCriticalData(context);

        expect(criticalData).toBeDefined();
        expect(criticalData.specifications).toEqual(context.partialSpecifications);
        expect(criticalData.phase).toBe(context.conversationPhase);
        expect(criticalData.lastMessage).toBe(context.lastUserMessage);
      });

      test('should return null when no critical data present', () => {
        const context = {};

        const criticalData = service.extractCriticalData(context);

        expect(criticalData).toBeNull();
      });
    });
  });

  describe('error handling edge cases', () => {
    test('should handle null/undefined context gracefully', async () => {
      const userId = 'test-user';
      const error = new Error('Test error');
      const operation = 'test_operation';

      const result1 = await service.handleError(userId, error, operation, null);
      const result2 = await service.handleError(userId, error, operation, undefined);

      expect(result1.successful).toBe(true);
      expect(result2.successful).toBe(true);
    });

    test('should handle conversation manager failures during recovery', async () => {
      const userId = 'test-user';
      const error = new Error('Original error');
      const operation = 'CLAUDE_API';
      const context = {};

      conversationManager.savePartialSpecification.mockRejectedValue(new Error('Save failed'));

      const result = await service.handleError(userId, error, operation, context);

      expect(result.successful).toBe(true); // Should still succeed despite save failure
    });
  });

  describe('performance', () => {
    test('should complete recovery within reasonable time', async () => {
      const userId = 'test-user';
      const error = new Error('Test error');
      const operation = 'test_operation';
      const context = {};

      const startTime = Date.now();
      await service.handleError(userId, error, operation, context);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});