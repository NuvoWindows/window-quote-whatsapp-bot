/**
 * Context Summarizer Tests
 * 
 * Tests the functionality of the context summarization system
 */

// Import the context summarizer
const contextSummarizer = require('../../utils/contextSummarizer');
const tokenEstimator = require('../../utils/tokenEstimator');

// Mock the logger and windowSpecParser dependencies
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../utils/windowSpecParser', () => ({
  parseWindowSpecifications: jest.fn()
}));

const windowSpecParser = require('../../utils/windowSpecParser');

describe('Context Summarizer', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('isImportantMessage', () => {
    test('should identify messages with window specification keywords', () => {
      // Test with window dimension message
      const dimensionMessage = { role: 'user', content: 'My window is 36 x 48 inches' };
      expect(contextSummarizer.isImportantMessage(dimensionMessage)).toBe(true);
      
      // Test with window type message
      const typeMessage = { role: 'user', content: 'I want a bay window' };
      expect(contextSummarizer.isImportantMessage(typeMessage)).toBe(true);
      
      // Test with glass type message
      const glassMessage = { role: 'user', content: 'I prefer triple pane glass' };
      expect(contextSummarizer.isImportantMessage(glassMessage)).toBe(true);
      
      // Test with location message
      const locationMessage = { role: 'user', content: 'It\'s for my kitchen' };
      expect(contextSummarizer.isImportantMessage(locationMessage)).toBe(true);
    });
    
    test('should not identify messages without important keywords', () => {
      // Test with generic message
      const genericMessage = { role: 'user', content: 'Hello, how are you?' };
      expect(contextSummarizer.isImportantMessage(genericMessage)).toBe(false);
      
      // Test with empty message
      const emptyMessage = { role: 'user', content: '' };
      expect(contextSummarizer.isImportantMessage(emptyMessage)).toBe(false);
      
      // Test with null message
      expect(contextSummarizer.isImportantMessage(null)).toBe(false);
    });
  });
  
  describe('extractUserInformation', () => {
    test('should extract window specifications from messages', () => {
      // Mock windowSpecParser
      windowSpecParser.parseWindowSpecifications.mockReturnValue({
        location: 'Kitchen',
        width: 36,
        height: 48,
        window_type: 'Standard',
        glass_type: 'Double pane',
        features: ['Grilles'],
        is_complete: true
      });
      
      // Sample messages
      const messages = [
        { role: 'user', content: 'I need a window for my kitchen' },
        { role: 'assistant', content: 'What size would you like?' },
        { role: 'user', content: '36 x 48 inches with standard type and double pane glass' }
      ];
      
      const result = contextSummarizer.extractUserInformation(messages);
      
      // Verify results
      expect(result.mentionedWindowSpecs).toBe(true);
      expect(result.location).toBe('Kitchen');
      expect(result.dimensions).toBe('36×48');
      expect(result.windowType).toBe('Standard');
      expect(result.glassType).toBe('Double pane');
      expect(result.features).toContain('Grilles');
      
      // Verify parser was called correctly
      expect(windowSpecParser.parseWindowSpecifications).toHaveBeenCalledWith(messages);
    });
    
    test('should handle incomplete specifications', () => {
      // Mock windowSpecParser for incomplete specs
      windowSpecParser.parseWindowSpecifications.mockReturnValue({
        location: 'Living room',
        width: null,
        height: null,
        window_type: null,
        glass_type: null,
        features: [],
        is_complete: false
      });
      
      // Sample messages
      const messages = [
        { role: 'user', content: 'I need a window for my living room' }
      ];
      
      const result = contextSummarizer.extractUserInformation(messages);
      
      // Verify results
      expect(result.mentionedWindowSpecs).toBe(false);
      expect(result.location).toBe('Living room');
      expect(result.dimensions).toBeNull();
      expect(result.windowType).toBeNull();
      expect(result.glassType).toBeNull();
      expect(result.features).toEqual([]);
    });
  });
  
  describe('summarizeMessageBlock', () => {
    test('should generate summary of conversation with specifications', () => {
      // Mock windowSpecParser
      windowSpecParser.parseWindowSpecifications.mockReturnValue({
        location: 'Kitchen',
        width: 36,
        height: 48,
        window_type: 'Standard',
        glass_type: 'Double pane',
        features: ['Grilles'],
        is_complete: true
      });
      
      // Sample messages
      const messages = [
        { role: 'user', content: 'I need a window for my kitchen' },
        { role: 'assistant', content: 'What size would you like?' },
        { role: 'user', content: '36 x 48 inches' },
        { role: 'assistant', content: 'What type of window?' },
        { role: 'user', content: 'Standard with double pane glass and grilles' }
      ];
      
      const summary = contextSummarizer.summarizeMessageBlock(messages);
      
      // Verify summary
      expect(summary.role).toBe('system');
      expect(summary.content).toContain('Conversation summary');
      expect(summary.content).toContain('3 user messages');
      expect(summary.content).toContain('2 assistant responses');
      expect(summary.content).toContain('Kitchen');
      expect(summary.content).toContain('36×48 inches');
      expect(summary.content).toContain('Standard type');
      expect(summary.content).toContain('Double pane');
      expect(summary.content).toContain('Grilles');
    });
    
    test('should handle empty message array', () => {
      expect(contextSummarizer.summarizeMessageBlock([])).toBeNull();
      expect(contextSummarizer.summarizeMessageBlock(null)).toBeNull();
    });
    
    test('should generate generic summary for messages without specifications', () => {
      // Mock windowSpecParser for incomplete specs
      windowSpecParser.parseWindowSpecifications.mockReturnValue({
        location: null,
        width: null,
        height: null,
        window_type: null,
        glass_type: null,
        features: [],
        is_complete: false
      });
      
      // Sample messages without specifications
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help you with your window needs?' },
        { role: 'user', content: 'I\'m just browsing' }
      ];
      
      const summary = contextSummarizer.summarizeMessageBlock(messages);
      
      // Verify summary
      expect(summary.role).toBe('system');
      expect(summary.content).toContain('Conversation summary');
      expect(summary.content).toContain('2 user messages');
      expect(summary.content).toContain('1 assistant responses');
      expect(summary.content).toContain('General discussion about window options');
    });
  });
  
  describe('optimizeContext', () => {
    // Mock token estimator for predictable results
    jest.spyOn(tokenEstimator, 'estimateConversationTokens').mockImplementation((messages) => {
      return messages.length * 100; // Each message is 100 tokens
    });
    
    jest.spyOn(tokenEstimator, 'estimateMessageTokens').mockImplementation((message) => {
      return 100; // Each message is 100 tokens
    });
    
    test('should return original messages if under token limit', () => {
      // Create 5 messages (500 tokens)
      const messages = Array(5).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      
      const optimized = contextSummarizer.optimizeContext(messages, 1000);
      
      // Should keep all messages since they're under the limit
      expect(optimized.length).toBe(5);
      expect(optimized).toEqual(messages);
    });
    
    test('should keep important messages when optimizing', () => {
      // Mock isImportantMessage to mark even-indexed messages as important
      jest.spyOn(contextSummarizer, 'isImportantMessage').mockImplementation((message) => {
        const index = parseInt(message.content.split(' ')[1]) - 1;
        return index % 2 === 0;
      });
      
      // Create 20 messages (2000 tokens)
      const messages = Array(20).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      
      // Set token limit to 1500 (can fit 15 messages)
      const optimized = contextSummarizer.optimizeContext(messages, 1500);
      
      // Should include a mix of important older messages and recent messages
      expect(optimized.length).toBeLessThan(messages.length);
      
      // Verify the most recent 10 messages are included
      const lastTenOriginal = messages.slice(-10);
      const lastTenOptimized = optimized.slice(-10);
      expect(lastTenOptimized).toEqual(lastTenOriginal);
    });
    
    test('should create summary when messages exceed token limit', () => {
      // Mock isImportantMessage to return false for all messages
      jest.spyOn(contextSummarizer, 'isImportantMessage').mockReturnValue(false);
      
      // Mock summarizeMessageBlock
      jest.spyOn(contextSummarizer, 'summarizeMessageBlock').mockReturnValue({
        role: 'system',
        content: 'This is a summary of the conversation'
      });
      
      // Create 30 messages (3000 tokens)
      const messages = Array(30).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      
      // Set token limit to 1500
      const optimized = contextSummarizer.optimizeContext(messages, 1500);
      
      // Should include a summary and recent messages
      expect(optimized.length).toBeLessThan(messages.length);
      
      // First message should be a system message (summary)
      expect(optimized[0].role).toBe('system');
      expect(optimized[0].content).toBe('This is a summary of the conversation');
    });
    
    test('should handle empty message array', () => {
      expect(contextSummarizer.optimizeContext([])).toEqual([]);
      expect(contextSummarizer.optimizeContext(null)).toEqual([]);
    });
    
    test('should fall back to limited recent messages when summary is too large', () => {
      // Mock token estimator to make each message 500 tokens
      tokenEstimator.estimateConversationTokens.mockImplementation((messages) => {
        return messages.length * 500;
      });
      
      tokenEstimator.estimateMessageTokens.mockImplementation((message) => {
        return 500;
      });
      
      // Mock summarizeMessageBlock to return a large summary
      jest.spyOn(contextSummarizer, 'summarizeMessageBlock').mockReturnValue({
        role: 'system',
        content: 'This is a very large summary' // 500 tokens
      });
      
      // Create 20 messages (10000 tokens total)
      const messages = Array(20).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      
      // Set token limit to 1000 (can fit 2 messages)
      const optimized = contextSummarizer.optimizeContext(messages, 1000);
      
      // Should only include the most recent messages that fit
      expect(optimized.length).toBe(2);
      
      // Verify we got the last 2 messages
      expect(optimized[0].content).toBe('Message 19');
      expect(optimized[1].content).toBe('Message 20');
    });
  });
});