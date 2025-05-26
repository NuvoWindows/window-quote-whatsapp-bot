const ConversationFlowService = require('../../services/conversationFlowService');

// Mock all dependencies
jest.mock('../../services/conversationManager');
jest.mock('../../utils/specificationValidator');
jest.mock('../../utils/questionGenerator');
jest.mock('../../utils/ambiguityDetector');
jest.mock('../../services/clarificationService');
jest.mock('../../services/claudeService');
jest.mock('../../services/professionalMeasurementService');
jest.mock('../../services/measurementDeferralService');

const conversationManager = require('../../services/conversationManager');
const SpecificationValidator = require('../../utils/specificationValidator');
const QuestionGenerator = require('../../utils/questionGenerator');
const AmbiguityDetector = require('../../utils/ambiguityDetector');
const ClarificationService = require('../../services/clarificationService');
const claudeService = require('../../services/claudeService');
const ProfessionalMeasurementService = require('../../services/professionalMeasurementService');
const MeasurementDeferralService = require('../../services/measurementDeferralService');

describe('ConversationFlowService', () => {
  let service;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    conversationManager.getConversationContext = jest.fn().mockResolvedValue([]);
    conversationManager.addMessage = jest.fn().mockResolvedValue();
    conversationManager.getPartialSpecification = jest.fn().mockResolvedValue({});
    conversationManager.savePartialSpecification = jest.fn().mockResolvedValue();
    conversationManager.getLastActivityTime = jest.fn().mockResolvedValue(null);
    conversationManager.updateLastActivity = jest.fn().mockResolvedValue();
    conversationManager.setConversationContext = jest.fn().mockResolvedValue();
    conversationManager.clearPartialSpecification = jest.fn().mockResolvedValue();
    conversationManager.clearConversationContext = jest.fn().mockResolvedValue();

    // Mock class constructors
    SpecificationValidator.mockImplementation(() => ({
      validateSpecifications: jest.fn(),
      getNextMissingField: jest.fn(),
      applyDefaults: jest.fn()
    }));

    QuestionGenerator.mockImplementation(() => ({
      generateQuestion: jest.fn(),
      generateSummaryQuestion: jest.fn(),
      generateProgressMessage: jest.fn()
    }));

    AmbiguityDetector.mockImplementation(() => ({
      detectAmbiguity: jest.fn(),
      resolveAmbiguity: jest.fn()
    }));

    ClarificationService.mockImplementation(() => ({
      getPendingClarification: jest.fn(),
      processUserClarification: jest.fn(),
      generateClarificationRequest: jest.fn(),
      savePendingClarification: jest.fn()
    }));

    claudeService.generateResponse = jest.fn();

    // Mock ProfessionalMeasurementService
    ProfessionalMeasurementService.mockImplementation(() => ({
      assessMeasurementComplexity: jest.fn(),
      generateMeasurementGuidance: jest.fn()
    }));

    // Mock MeasurementDeferralService
    MeasurementDeferralService.mockImplementation(() => ({
      createDeferral: jest.fn(),
      resumeDeferredQuote: jest.fn()
    }));

    service = new ConversationFlowService(conversationManager);
  });

  describe('processUserMessage', () => {
    test('should handle new conversation with insufficient specifications', async () => {
      const userId = 'test-user';
      const message = 'I need a window quote';
      
      // Mock validator to return incomplete specs
      service.specValidator.validateSpecifications.mockReturnValue({
        isValid: false,
        canGenerateQuote: false,
        missing: [
          { field: 'operation_type', label: 'Operation Type', priority: 1 },
          { field: 'width', label: 'Width', priority: 1 },
          { field: 'height', label: 'Height', priority: 1 }
        ],
        completionPercentage: 10
      });
      
      // Mock question generator
      const mockQuestion = 'What type of window do you need?';
      service.questionGenerator.generateQuestion.mockReturnValue(mockQuestion);
      service.questionGenerator.generateProgressMessage.mockReturnValue('Let\'s get started!');
      service.specValidator.getNextMissingField.mockReturnValue(
        { field: 'operation_type', label: 'Operation Type', priority: 1 }
      );
      
      // Mock no pending clarifications
      service.clarificationService.getPendingClarification.mockResolvedValue(null);
      
      // Mock no ambiguities detected
      service.ambiguityDetector.detectAmbiguity.mockReturnValue([]);
      
      const result = await service.processUserMessage(userId, message);
      
      expect(result.type).toBe('COLLECT_INFORMATION');
      expect(result.message).toContain(mockQuestion);
      expect(result.requiresInput).toBe(true);
    });

    test('should handle pending clarifications', async () => {
      const userId = 'test-user';
      const message = 'double-pane glass';
      
      // Mock pending clarification
      const pendingClarification = {
        ambiguity: {
          field: 'glass_type',
          term: 'glass type unclear'
        }
      };
      service.clarificationService.getPendingClarification.mockResolvedValue(pendingClarification);
      
      const clarificationResult = {
        resolved: true,
        updatedSpecs: { glass_type: 'double-pane' },
        resolvedFields: ['glass_type']
      };
      service.clarificationService.processUserClarification.mockResolvedValue(clarificationResult);
      
      // Mock validator for updated specs
      service.specValidator.validateSpecifications.mockReturnValue({
        isValid: false,
        canGenerateQuote: false,
        missing: [{ field: 'width', label: 'Width', priority: 1 }],
        completionPercentage: 60
      });
      
      service.specValidator.getNextMissingField.mockReturnValue(
        { field: 'width', label: 'Width', priority: 1 }
      );
      service.questionGenerator.generateQuestion.mockReturnValue('What is the width?');
      service.questionGenerator.generateProgressMessage.mockReturnValue('Almost there!');
      
      const result = await service.processUserMessage(userId, message);
      
      expect(service.clarificationService.processUserClarification).toHaveBeenCalledWith(
        userId, message, pendingClarification.ambiguity, {}
      );
      expect(result.type).toBe('COLLECT_INFORMATION');
    });

    test('should detect and handle ambiguities', async () => {
      const userId = 'test-user';
      const message = 'I want a standard window';
      
      // Mock no pending clarifications
      service.clarificationService.getPendingClarification.mockResolvedValue(null);
      
      // Mock partial specs
      conversationManager.getPartialSpecification.mockResolvedValue({});
      
      // Mock ambiguity detection
      const ambiguities = [
        {
          field: 'operation_type',
          term: 'standard',
          suggestions: ['casement', 'double-hung'],
          confidence: 0.8
        }
      ];
      service.ambiguityDetector.detectAmbiguity.mockReturnValue(ambiguities);
      
      // Mock clarification service
      const clarificationRequest = {
        type: 'CLARIFICATION_REQUEST',
        message: 'What type of window do you mean by "standard"?',
        ambiguity: ambiguities[0],
        expectingClarification: true
      };
      service.clarificationService.generateClarificationRequest.mockReturnValue(clarificationRequest);
      
      const result = await service.processUserMessage(userId, message);
      
      expect(result.type).toBe('NEEDS_CLARIFICATION');
      expect(result.message).toBe(clarificationRequest.message);
    });

    test('should generate quote when specifications are complete', async () => {
      const userId = 'test-user';
      const message = 'Generate my quote';
      
      const completeSpecs = {
        operation_type: 'casement',
        width: '48',
        height: '36',
        glass_type: 'clear',
        pane_count: 2
      };
      
      // Mock no pending clarifications
      service.clarificationService.getPendingClarification.mockResolvedValue(null);
      
      // Mock partial specs
      conversationManager.getPartialSpecification.mockResolvedValue(completeSpecs);
      
      // Mock no ambiguities
      service.ambiguityDetector.detectAmbiguity.mockReturnValue([]);
      
      // Mock validator shows complete specs
      service.specValidator.validateSpecifications.mockReturnValue({
        isValid: true,
        canGenerateQuote: true,
        missing: [],
        completionPercentage: 100
      });
      
      const result = await service.processUserMessage(userId, message, completeSpecs);
      
      expect(result.type).toBe('GENERATE_QUOTE');
      expect(result.specs).toEqual(completeSpecs);
      expect(result.requiresInput).toBe(false);
    });

    test('should handle conversation flow state properly', async () => {
      const userId = 'test-user';
      const message = 'I need help with windows';
      
      const existingContext = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' }
      ];
      conversationManager.getConversationContext.mockResolvedValue(existingContext);
      
      // Mock no pending clarifications
      service.clarificationService.getPendingClarification.mockResolvedValue(null);
      
      // Mock empty partial specs
      conversationManager.getPartialSpecification.mockResolvedValue({});
      
      // Mock no ambiguities
      service.ambiguityDetector.detectAmbiguity.mockReturnValue([]);
      
      const result = await service.processUserMessage(userId, message);
      
      expect(conversationManager.getPartialSpecification).toHaveBeenCalledWith(userId);
    });

    test('should handle errors gracefully', async () => {
      const userId = 'test-user';
      const message = 'test message';
      
      // Mock an error in conversation manager
      conversationManager.getConversationContext.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const result = await service.processUserMessage(userId, message);
      
      expect(result.type).toBe('ERROR');
      expect(result.message).toBeDefined();
      expect(result.requiresInput).toBe(true);
    });
  });

  describe('handleReturningUser', () => {
    test('should handle returning user with partial specifications', async () => {
      const userId = 'test-user';
      const partialSpecs = {
        operation_type: 'casement',
        width: '48'
      };
      
      conversationManager.getPartialSpecification.mockResolvedValue(partialSpecs);
      conversationManager.getLastActivityTime.mockResolvedValue(new Date());
      
      service.specValidator.validateSpecifications.mockReturnValue({
        isValid: false,
        canGenerateQuote: false,
        missing: [{ field: 'height', label: 'Height', priority: 1 }],
        completionPercentage: 60
      });
      
      const result = await service.handleReturningUser(userId);
      
      expect(result.type).toBe('WELCOME_BACK');
      expect(result.message).toContain('Welcome back');
      expect(result.resumedConversation).toBe(true);
    });
  });

  describe('clearConversationState', () => {
    test('should clear all conversation state', async () => {
      const userId = 'test-user';
      
      await service.clearConversationState(userId);
      
      expect(conversationManager.clearPartialSpecification).toHaveBeenCalledWith(userId);
      expect(conversationManager.clearConversationContext).toHaveBeenCalledWith(userId);
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete conversation flow from start to quote', async () => {
      const userId = 'test-user';
      
      // Step 1: Initial request
      service.clarificationService.getPendingClarification.mockResolvedValue(null);
      conversationManager.getPartialSpecification.mockResolvedValue({});
      service.ambiguityDetector.detectAmbiguity.mockReturnValue([]);
      
      service.specValidator.validateSpecifications.mockReturnValueOnce({
        isValid: false,
        canGenerateQuote: false,
        missing: [
          { field: 'operation_type', label: 'Operation Type', priority: 1 },
          { field: 'width', label: 'Width', priority: 1 },
          { field: 'height', label: 'Height', priority: 1 }
        ]
      });
      
      service.questionGenerator.generateQuestion.mockReturnValue(
        'What type of window do you need?'
      );
      service.questionGenerator.generateProgressMessage.mockReturnValue('Let\'s get started!');
      service.specValidator.getNextMissingField.mockReturnValue(
        { field: 'operation_type', label: 'Operation Type', priority: 1 }
      );
      
      let result = await service.processUserMessage(userId, 'I need a window quote');
      expect(result.type).toBe('COLLECT_INFORMATION');
      
      // Step 2: Provide window type
      conversationManager.getPartialSpecification.mockResolvedValue({
        operation_type: 'casement'
      });
      
      service.specValidator.validateSpecifications.mockReturnValueOnce({
        isValid: false,
        canGenerateQuote: false,
        missing: [
          { field: 'width', label: 'Width', priority: 1 },
          { field: 'height', label: 'Height', priority: 1 }
        ]
      });
      
      result = await service.processUserMessage(userId, 'casement window', { operation_type: 'casement' });
      expect(result.type).toBe('COLLECT_INFORMATION');
      
      // Step 3: Complete specifications
      conversationManager.getPartialSpecification.mockResolvedValue({
        operation_type: 'casement',
        width: '48',
        height: '36'
      });
      
      service.specValidator.validateSpecifications.mockReturnValueOnce({
        isValid: true,
        canGenerateQuote: true,
        missing: []
      });
      
      result = await service.processUserMessage(userId, '48 inches wide by 36 inches tall', { width: '48', height: '36' });
      expect(result.type).toBe('GENERATE_QUOTE');
      expect(result.requiresInput).toBe(false);
    });
  });
});