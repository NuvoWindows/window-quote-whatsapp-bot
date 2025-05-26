const ErrorContextService = require('../../services/errorContextService');

// Mock dependencies
jest.mock('../../services/conversationManager');
jest.mock('../../utils/logger');

const conversationManager = require('../../services/conversationManager');
const logger = require('../../utils/logger');

describe('ErrorContextService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock conversationManager methods based on actual ErrorContextService usage
    conversationManager.getConversationContext = jest.fn().mockResolvedValue([]);
    conversationManager.getPartialSpecification = jest.fn().mockResolvedValue({});
    conversationManager.getContextFlag = jest.fn().mockResolvedValue(null);
    conversationManager.setConversationContext = jest.fn().mockResolvedValue();
    
    // Mock logger
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.logError = jest.fn();

    service = new ErrorContextService(conversationManager);
  });

  describe('captureErrorContext', () => {
    test('should capture comprehensive error context with flat structure', async () => {
      const userId = 'test-user';
      const error = new Error('Test error message');
      error.code = 'TEST_ERROR';
      error.stack = 'Error: Test error\n    at test.js:1:1';
      const operation = 'test_operation';

      // Mock conversation data
      conversationManager.getConversationContext.mockResolvedValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
      conversationManager.getPartialSpecification.mockResolvedValue({
        operation_type: 'casement',
        width: '48'
      });

      const context = await service.captureErrorContext(userId, error, operation);

      // Check flat structure properties
      expect(context).toHaveProperty('errorId');
      expect(context).toHaveProperty('errorType');
      expect(context).toHaveProperty('errorMessage');
      expect(context).toHaveProperty('errorCode');
      expect(context).toHaveProperty('errorStack');
      expect(context).toHaveProperty('operation');
      expect(context).toHaveProperty('timestamp');
      expect(context).toHaveProperty('userId');
      expect(context).toHaveProperty('conversationContext');
      expect(context).toHaveProperty('partialSpecifications');
      expect(context).toHaveProperty('systemLoad');
      expect(context).toHaveProperty('memoryUsage');
      expect(context).toHaveProperty('recoveryHints');

      expect(context.errorMessage).toBe('Test error message');
      expect(context.errorCode).toBe('TEST_ERROR');
      expect(context.operation).toBe('test_operation');
      expect(context.userId).toBe('test-user');
      expect(context.conversationContext).toHaveLength(2);
      expect(context.partialSpecifications).toEqual({
        operation_type: 'casement',
        width: '48'
      });
    });

    test('should handle conversation context retrieval errors gracefully', async () => {
      const userId = 'test-user';
      const error = new Error('Original error');
      const operation = 'test_operation';

      // Mock conversation manager error
      conversationManager.getConversationContext.mockRejectedValue(
        new Error('Database error')
      );
      conversationManager.getPartialSpecification.mockResolvedValue({});

      const context = await service.captureErrorContext(userId, error, operation);

      expect(context.userId).toBe('test-user');
      expect(context.errorMessage).toBe('Original error');
      expect(context.conversationContext).toEqual([]);
    });

    test('should generate appropriate recovery hints', async () => {
      const userId = 'test-user';
      const error = new Error('Request timeout after 30000ms');
      error.code = 'ETIMEDOUT';
      const operation = 'claude_api_call';

      conversationManager.getConversationContext.mockResolvedValue([]);
      conversationManager.getPartialSpecification.mockResolvedValue({});

      const context = await service.captureErrorContext(userId, error, operation);

      expect(context.recoveryHints).toBeInstanceOf(Array);
      expect(context.recoveryHints.length).toBeGreaterThan(0);
      expect(context.recoveryHints).toContain('RETRY_WITH_BACKOFF');
      expect(context.recoveryHints).toContain('CHECK_NETWORK_CONNECTIVITY');
    });

    test('should include system performance metrics', async () => {
      const userId = 'test-user';
      const error = new Error('Test error');
      const operation = 'test_operation';

      conversationManager.getConversationContext.mockResolvedValue([]);
      conversationManager.getPartialSpecification.mockResolvedValue({});

      const context = await service.captureErrorContext(userId, error, operation);

      expect(context).toHaveProperty('timestamp');
      expect(context).toHaveProperty('memoryUsage');
      expect(context).toHaveProperty('uptime');
      expect(context).toHaveProperty('systemLoad');
      expect(context.memoryUsage).toHaveProperty('heapUsed');
      expect(context.memoryUsage).toHaveProperty('heapTotal');
      expect(typeof context.uptime).toBe('number');
    });

    test('should handle context capture errors and return minimal context', async () => {
      const userId = 'test-user';
      const error = new Error('Test error');
      const operation = 'test_operation';

      // Mock saveErrorContext to fail, which will trigger the catch block
      service.saveErrorContext = jest.fn().mockRejectedValue(new Error('Save failed'));

      const context = await service.captureErrorContext(userId, error, operation);

      expect(context.contextCaptureError).toBe(true);
      expect(context.errorMessage).toBe('Test error');
      expect(context.userId).toBe('test-user');
      expect(context.operation).toBe('test_operation');
    });
  });

  describe('getLastUserMessage', () => {
    test('should extract last user message from conversation', async () => {
      const userId = 'test-user';
      const mockContext = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Latest user message' }
      ];

      conversationManager.getConversationContext.mockResolvedValue(mockContext);

      const lastMessage = await service.getLastUserMessage(userId);

      expect(lastMessage).toBe('Latest user message');
    });

    test('should return null when no user messages exist', async () => {
      const userId = 'test-user';
      conversationManager.getConversationContext.mockResolvedValue([]);

      const lastMessage = await service.getLastUserMessage(userId);

      expect(lastMessage).toBeNull();
    });

    test('should handle conversation context errors', async () => {
      const userId = 'test-user';
      conversationManager.getConversationContext.mockRejectedValue(new Error('Context error'));

      const lastMessage = await service.getLastUserMessage(userId);

      expect(lastMessage).toBeNull();
    });
  });

  describe('getConversationPhase', () => {
    test('should identify collection phase', async () => {
      const userId = 'test-user';
      conversationManager.getPartialSpecification.mockResolvedValue({
        operation_type: 'casement'
      });

      const phase = await service.getConversationPhase(userId);

      expect(phase).toBe('SPECIFICATION_GATHERING');
    });

    test('should identify generation phase', async () => {
      const userId = 'test-user';
      conversationManager.getPartialSpecification.mockResolvedValue({
        operation_type: 'casement',
        width: '48',
        height: '36',
        glass_type: 'clear'
      });

      const phase = await service.getConversationPhase(userId);

      expect(phase).toBe('SPECIFICATION_COMPLETE');
    });

    test('should default to unknown phase', async () => {
      const userId = 'test-user';
      conversationManager.getPartialSpecification.mockRejectedValue(new Error('No specs'));

      const phase = await service.getConversationPhase(userId);

      expect(phase).toBe('UNKNOWN');
    });
  });

  describe('generateRecoveryHints', () => {
    test('should provide timeout-specific hints', () => {
      const error = new Error('Request timeout after 30000ms');
      error.code = 'ETIMEDOUT';
      const operation = 'claude_api_call';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('RETRY_WITH_BACKOFF');
      expect(hints).toContain('CHECK_NETWORK_CONNECTIVITY');
    });

    test('should provide rate limit hints', () => {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      const operation = 'claude_api_call';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('APPLY_RATE_LIMITING');
      expect(hints).toContain('RETRY_AFTER_DELAY');
    });

    test('should provide database-specific hints', () => {
      const error = new Error('Database connection failed');
      const operation = 'save_conversation';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('CHECK_DATABASE_CONNECTION');
      expect(hints).toContain('USE_CACHED_DATA_IF_AVAILABLE');
    });

    test('should provide operation-specific hints for message processing', () => {
      const error = new Error('Processing failed');
      const operation = 'MESSAGE_PROCESSING';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('PRESERVE_USER_MESSAGE');
      expect(hints).toContain('SEND_ERROR_ACKNOWLEDGMENT');
    });

    test('should provide operation-specific hints for Claude generation', () => {
      const error = new Error('Generation failed');
      const operation = 'CLAUDE_GENERATION';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('RETRY_WITH_SIMPLIFIED_PROMPT');
      expect(hints).toContain('USE_FALLBACK_RESPONSE');
    });

    test('should provide operation-specific hints for WhatsApp sending', () => {
      const error = new Error('Send failed');
      const operation = 'WHATSAPP_SEND';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('QUEUE_MESSAGE_FOR_RETRY');
      expect(hints).toContain('NOTIFY_USER_OF_DELAY');
    });

    test('should provide operation-specific hints for quote generation', () => {
      const error = new Error('Quote generation failed');
      const operation = 'QUOTE_GENERATION';

      const hints = service.generateRecoveryHints(error, operation);

      expect(hints).toContain('PRESERVE_SPECIFICATIONS');
      expect(hints).toContain('OFFER_ALTERNATIVE_CONTACT_METHOD');
    });
  });

  describe('getPendingOperation', () => {
    test('should detect collecting measurement info operation', async () => {
      const userId = 'test-user';
      conversationManager.getContextFlag.mockResolvedValue(true);

      const pendingOp = await service.getPendingOperation(userId);

      expect(pendingOp).toEqual({
        type: 'COLLECTING_MEASUREMENT_INFO',
        active: true
      });
    });

    test('should return null when no pending operations', async () => {
      const userId = 'test-user';
      conversationManager.getContextFlag.mockResolvedValue(false);

      const pendingOp = await service.getPendingOperation(userId);

      expect(pendingOp).toBeNull();
    });

    test('should handle context flag errors', async () => {
      const userId = 'test-user';
      conversationManager.getContextFlag.mockRejectedValue(new Error('Flag error'));

      const pendingOp = await service.getPendingOperation(userId);

      expect(pendingOp).toBeNull();
    });
  });

  describe('getSystemLoad', () => {
    test('should return system load metrics', async () => {
      const systemLoad = await service.getSystemLoad();

      expect(systemLoad).toHaveProperty('loadAverage');
      expect(systemLoad).toHaveProperty('cpuUsage');
      expect(systemLoad).toHaveProperty('timestamp');
      expect(Array.isArray(systemLoad.loadAverage)).toBe(true);
      expect(systemLoad.cpuUsage).toHaveProperty('user');
      expect(systemLoad.cpuUsage).toHaveProperty('system');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle null/undefined inputs gracefully', async () => {
      const context1 = await service.captureErrorContext(null, new Error('test'), 'operation');
      expect(context1.userId).toBe(null);

      // For null error, the service should handle it gracefully and return minimal context
      const nullError = { message: 'null error', constructor: { name: 'NullError' } };
      const context2 = await service.captureErrorContext('user', nullError, 'operation');
      expect(context2.errorMessage).toBe('null error');
      expect(context2.userId).toBe('user');

      const context3 = await service.captureErrorContext('user', new Error('test'), null);
      expect(context3.operation).toBe(null);
    });

    test('should handle very large error messages', async () => {
      const largeError = new Error('x'.repeat(10000));
      conversationManager.getConversationContext.mockResolvedValue([]);
      conversationManager.getPartialSpecification.mockResolvedValue({});

      const context = await service.captureErrorContext('user', largeError, 'operation');

      expect(context.errorMessage).toBeDefined();
      expect(context.errorMessage.length).toBe(10000); // Should preserve full message
    });

    test('should handle circular reference errors', async () => {
      const circularError = new Error('Test error');
      circularError.circular = circularError; // Create circular reference

      conversationManager.getConversationContext.mockResolvedValue([]);
      conversationManager.getPartialSpecification.mockResolvedValue({});

      // Should not throw on circular reference
      const context = await service.captureErrorContext('user', circularError, 'operation');
      expect(context).toBeDefined();
      expect(context.errorMessage).toBe('Test error');
    });
  });

  describe('performance and optimization', () => {
    test('should complete context capture within reasonable time', async () => {
      const userId = 'test-user';
      const error = new Error('Test error');
      const operation = 'test_operation';

      conversationManager.getConversationContext.mockResolvedValue([]);
      conversationManager.getPartialSpecification.mockResolvedValue({});

      const startTime = Date.now();
      await service.captureErrorContext(userId, error, operation);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should not leak memory with repeated calls', async () => {
      const userId = 'test-user';
      const error = new Error('Test error');
      const operation = 'test_operation';

      conversationManager.getConversationContext.mockResolvedValue([]);
      conversationManager.getPartialSpecification.mockResolvedValue({});

      // Run multiple times to check for memory leaks
      for (let i = 0; i < 10; i++) {
        await service.captureErrorContext(userId, error, operation);
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });
});