const ClarificationService = require('../../services/clarificationService');

// Mock dependencies
jest.mock('../../services/conversationManager');
jest.mock('../../utils/ambiguityDetector');

const conversationManager = require('../../services/conversationManager');
const AmbiguityDetector = require('../../utils/ambiguityDetector');

describe('ClarificationService', () => {
  let service;
  let mockAmbiguityDetector;
  let mockConversationManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock AmbiguityDetector
    mockAmbiguityDetector = {
      resolveAmbiguity: jest.fn(),
      getAmbiguityPriority: jest.fn()
    };
    AmbiguityDetector.mockImplementation(() => mockAmbiguityDetector);

    // Mock conversationManager
    mockConversationManager = {
      setConversationContext: jest.fn().mockResolvedValue(),
      getConversationContext: jest.fn().mockResolvedValue({}),
      savePartialSpecification: jest.fn().mockResolvedValue()
    };
    conversationManager.setConversationContext = mockConversationManager.setConversationContext;
    conversationManager.getConversationContext = mockConversationManager.getConversationContext;
    conversationManager.savePartialSpecification = mockConversationManager.savePartialSpecification;

    service = new ClarificationService(mockConversationManager);
  });

  describe('generateClarificationRequest', () => {
    test('should create clarification request for single ambiguity', () => {
      const ambiguities = [
        {
          type: 'operation',
          field: 'window_type',
          term: 'standard',
          suggestions: ['casement', 'double-hung', 'slider'],
          confidence: 0.8,
          clarifyMessage: 'When you say "standard", did you mean casement, double-hung, or slider?'
        }
      ];
      const currentSpecs = { width: '36', height: '48' };

      const result = service.generateClarificationRequest(ambiguities, currentSpecs);

      expect(result).toBeDefined();
      expect(result.message).toContain('standard');
      expect(result.type).toBe('CLARIFICATION_REQUEST');
      expect(result.expectingClarification).toBe(true);
    });

    test('should handle multiple ambiguities by prioritizing', () => {
      const ambiguities = [
        {
          type: 'glass',
          field: 'glass_type',
          term: 'normal',
          suggestions: ['clear', 'tinted'],
          confidence: 0.6,
          clarifyMessage: 'When you say "normal", did you mean clear or tinted?'
        },
        {
          type: 'operation',
          field: 'window_type',
          term: 'standard',
          suggestions: ['casement', 'double-hung'],
          confidence: 0.9,
          clarifyMessage: 'When you say "standard", did you mean casement or double-hung?'
        }
      ];

      const result = service.generateClarificationRequest(ambiguities, {});

      expect(result.message).toContain('standard');
      expect(result.ambiguity.type).toBe('operation');
      // Should prioritize window_type (operation) over glass_type
    });

    test('should include context in clarification requests', () => {
      const ambiguities = [
        {
          type: 'glass',
          field: 'glass_type',
          term: 'normal',
          suggestions: ['clear', 'tinted', 'low-e'],
          confidence: 0.7,
          clarifyMessage: 'When you say "normal", did you mean clear, tinted, or low-e glass?'
        }
      ];
      const currentSpecs = {
        operation_type: 'casement',
        width: '48',
        height: '36'
      };

      const result = service.generateClarificationRequest(ambiguities, currentSpecs);

      expect(result.message).toContain('48x36');
      // Should include context prefix
      expect(result.message).toContain('For your');
    });

    test('should handle empty ambiguities array', () => {
      const result = service.generateClarificationRequest([], {});

      expect(result).toBeNull();
    });
  });

  describe('processUserClarification', () => {
    test('should successfully resolve clear clarification', async () => {
      const userId = 'test-user';
      const userResponse = 'casement window';
      const pendingAmbiguity = {
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung', 'slider']
      };
      const currentSpecs = { width: '36', height: '48' };

      // Mock successful resolution
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue({
        operation_type: 'casement'
      });

      const result = await service.processUserClarification(
        userId, userResponse, pendingAmbiguity, currentSpecs
      );

      expect(result.resolved).toBe(true);
      expect(result.updatedSpecs.operation_type).toBe('casement');
      expect(result.resolvedFields).toContain('operation_type');
      expect(mockConversationManager.setConversationContext).toHaveBeenCalledWith(
        userId, 'pendingClarification', null
      );
    });

    test('should handle failed resolution gracefully', async () => {
      const userId = 'test-user';
      const userResponse = 'what are the options?';
      const pendingAmbiguity = {
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung', 'slider']
      };

      // Mock failed resolution - returns null
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue(null);

      const result = await service.processUserClarification(
        userId, userResponse, pendingAmbiguity, {}
      );

      expect(result.resolved).toBe(false);
      expect(result.needsHelp).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message).toContain('options');
    });

    test('should handle dimension clarifications', async () => {
      const userId = 'test-user';
      const userResponse = '36 inches by 48 inches';
      const pendingAmbiguity = {
        field: 'size',
        term: 'standard',
        suggestions: ['36x48', '30x60', '24x36']
      };

      // Mock dimension resolution
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue({
        width: '36',
        height: '48'
      });

      const result = await service.processUserClarification(
        userId, userResponse, pendingAmbiguity, {}
      );

      expect(result.resolved).toBe(true);
      expect(result.updatedSpecs.width).toBe('36');
      expect(result.updatedSpecs.height).toBe('48');
    });

    test('should handle clarification for unknown field type gracefully', async () => {
      const userId = 'test-user';
      const userResponse = 'I want something special';
      const pendingAmbiguity = {
        type: 'unknown_type',
        field: 'special_field',
        term: 'special',
        suggestions: ['option1', 'option2']
      };

      // Mock successful resolution
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue({
        special_field: 'option1'
      });

      const result = await service.processUserClarification(
        userId, userResponse, pendingAmbiguity, {}
      );

      expect(result.resolved).toBe(true);
      expect(result.updatedSpecs.special_field).toBe('option1');
    });
  });

  describe('getPendingClarification', () => {
    test('should retrieve pending clarification from conversation context', async () => {
      const userId = 'test-user';
      const pendingClarification = {
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung']
      };

      mockConversationManager.getConversationContext.mockResolvedValue([
        {
          role: 'system',
          content: 'System context with pendingClarification',
          pendingClarification: pendingClarification
        }
      ]);

      const result = await service.getPendingClarification(userId);

      expect(result).toEqual(pendingClarification);
      expect(mockConversationManager.getConversationContext).toHaveBeenCalledWith(userId, 1);
    });

    test('should return null when no pending clarification', async () => {
      const userId = 'test-user';

      mockConversationManager.getConversationContext.mockResolvedValue([]);

      const result = await service.getPendingClarification(userId);

      expect(result).toBeNull();
    });

    test('should handle conversation manager errors', async () => {
      const userId = 'test-user';

      mockConversationManager.getConversationContext.mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.getPendingClarification(userId);

      expect(result).toBeNull();
    });
  });

  describe('clearPendingClarification', () => {
    test('should clear pending clarification from conversation context', async () => {
      const userId = 'test-user';

      await service.clearPendingClarification(userId);

      expect(mockConversationManager.setConversationContext).toHaveBeenCalledWith(
        userId, 'pendingClarification', null
      );
    });

    test('should handle errors gracefully', async () => {
      const userId = 'test-user';

      mockConversationManager.setConversationContext.mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(service.clearPendingClarification(userId)).resolves.toBeUndefined();
    });
  });

  describe('generateContextualClarification', () => {
    test('should generate appropriate message for window type clarification', () => {
      const ambiguity = {
        type: 'operation',
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung', 'slider'],
        confidence: 0.8,
        clarifyMessage: 'When you say "standard", did you mean casement, double-hung, or slider?'
      };
      const context = { width: '48', height: '36' };

      const message = service.generateContextualClarification(ambiguity, context);

      expect(message).toContain('48x36');
      expect(message).toContain('standard');
    });

    test('should generate appropriate message for size clarification', () => {
      const ambiguity = {
        type: 'size',
        field: 'size',
        term: 'standard',
        suggestions: ['36x48', '30x60', '24x36'],
        confidence: 0.7,
        clarifyMessage: 'What size did you mean by "standard"? Common sizes are 36x48, 30x60, or 24x36.'
      };
      const context = { operation_type: 'casement' };

      const message = service.generateContextualClarification(ambiguity, context);

      expect(message).toContain('standard');
      expect(message).toContain('For your window');
    });

    test('should include context in clarification messages', () => {
      const ambiguity = {
        type: 'glass',
        field: 'glass_type',
        term: 'normal',
        suggestions: ['clear', 'tinted', 'low-e'],
        confidence: 0.6,
        clarifyMessage: 'When you say "normal" glass, did you mean clear, tinted, or low-e?'
      };
      const context = {
        operation_type: 'casement',
        width: '48',
        height: '36'
      };

      const message = service.generateContextualClarification(ambiguity, context);

      expect(message).toContain('48x36');
      expect(message).toContain('normal');
    });

    test('should handle unknown field types gracefully', () => {
      const ambiguity = {
        type: 'unknown',
        field: 'unknown_field',
        term: 'standard',
        suggestions: ['option1', 'option2'],
        confidence: 0.5,
        clarifyMessage: 'What did you mean by "standard"?'
      };

      const message = service.generateContextualClarification(ambiguity, {});

      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('standard');
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete clarification flow', async () => {
      const userId = 'test-user';
      const ambiguities = [
        {
          type: 'operation',
          field: 'window_type',
          term: 'standard',
          suggestions: ['casement', 'double-hung'],
          confidence: 0.8,
          clarifyMessage: 'Did you mean casement or double-hung?'
        }
      ];

      // Step 1: Request clarification
      const clarificationResult = service.generateClarificationRequest(ambiguities, {});
      expect(clarificationResult).toBeDefined();
      expect(clarificationResult.type).toBe('CLARIFICATION_REQUEST');

      // Step 2: User responds
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue({
        operation_type: 'casement'
      });

      const processingResult = await service.processUserClarification(
        userId, 'casement', ambiguities[0], {}
      );

      expect(processingResult.resolved).toBe(true);
      expect(processingResult.updatedSpecs.operation_type).toBe('casement');
    });

    test('should handle cascading clarifications', async () => {
      const userId = 'test-user';

      // First clarification
      const firstAmbiguity = {
        type: 'operation',
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung'],
        confidence: 0.8
      };

      // Mock resolution returning operation type
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue({
        operation_type: 'casement'
      });

      const result = await service.processUserClarification(
        userId, 'casement window', firstAmbiguity, {}
      );

      expect(result.resolved).toBe(true);
      expect(result.updatedSpecs.operation_type).toBe('casement');
    });

    test('should handle failed clarification with retry', async () => {
      const userId = 'test-user';
      const ambiguity = {
        type: 'operation',
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung'],
        confidence: 0.8
      };

      // First attempt fails - returns null
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValueOnce(null);

      const firstResult = await service.processUserClarification(
        userId, 'what are the options', ambiguity, {}
      );

      expect(firstResult.resolved).toBe(false);
      expect(firstResult.needsHelp).toBe(true);

      // Second attempt succeeds
      mockAmbiguityDetector.resolveAmbiguity.mockReturnValueOnce({
        operation_type: 'casement'
      });

      const secondResult = await service.processUserClarification(
        userId, 'casement', ambiguity, {}
      );

      expect(secondResult.resolved).toBe(true);
      expect(secondResult.updatedSpecs.operation_type).toBe('casement');
    });
  });

  describe('edge cases', () => {
    test('should handle malformed ambiguity objects', async () => {
      const userId = 'test-user';
      const malformedAmbiguities = [
        { field: 'window_type' }, // missing required properties
        { term: 'standard' } // missing field
      ];

      const result = service.generateClarificationRequest(malformedAmbiguities, {});

      expect(result).toBeNull();
    });

    test('should handle very long user responses', async () => {
      const userId = 'test-user';
      const longResponse = 'casement '.repeat(100);
      const ambiguity = {
        type: 'operation',
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung']
      };

      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue({
        operation_type: 'casement'
      });

      const result = await service.processUserClarification(
        userId, longResponse, ambiguity, {}
      );

      expect(result.resolved).toBe(true);
    });

    test('should handle empty user responses', async () => {
      const userId = 'test-user';
      const ambiguity = {
        type: 'operation',
        field: 'window_type',
        term: 'standard',
        suggestions: ['casement', 'double-hung']
      };

      mockAmbiguityDetector.resolveAmbiguity.mockReturnValue(null);

      const result = await service.processUserClarification(
        userId, '', ambiguity, {}
      );

      expect(result.resolved).toBe(false);
      expect(result.retry).toBe(true);
    });
  });
});