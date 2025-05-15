/**
 * Token Estimator Tests
 * 
 * Tests the functionality of the token estimator utility
 */

// Import the token estimator
const tokenEstimator = require('../../utils/tokenEstimator');

describe('Token Estimator', () => {
  describe('estimateTokens', () => {
    test('should estimate tokens based on character count', () => {
      // Test with simple text
      expect(tokenEstimator.estimateTokens('Hello, world!')).toBe(4); // 13 chars / 4 chars per token = 3.25 => 4 tokens
      
      // Test with longer text
      const text = 'This is a longer piece of text that should convert to more tokens than the first example.';
      expect(tokenEstimator.estimateTokens(text)).toBe(Math.ceil(text.length / 4));
      
      // Test with empty string
      expect(tokenEstimator.estimateTokens('')).toBe(0);
      
      // Test with null or undefined
      expect(tokenEstimator.estimateTokens(null)).toBe(0);
      expect(tokenEstimator.estimateTokens(undefined)).toBe(0);
    });
  });
  
  describe('estimateMessageTokens', () => {
    test('should estimate tokens for message objects', () => {
      // Test with user message
      const userMessage = { role: 'user', content: 'Hello, how are you?' };
      // 19 chars / 4 = 4.75 => 5 tokens + 3 for role overhead = 8 tokens
      expect(tokenEstimator.estimateMessageTokens(userMessage)).toBe(8);
      
      // Test with assistant message
      const assistantMessage = { role: 'assistant', content: 'I am fine, thank you!' };
      // 20 chars / 4 = 5 tokens + 3 for role overhead = 8 tokens
      expect(tokenEstimator.estimateMessageTokens(assistantMessage)).toBe(8);
      
      // Test with empty content
      expect(tokenEstimator.estimateMessageTokens({ role: 'user', content: '' })).toBe(3); // Just role overhead
      
      // Test with null or invalid message
      expect(tokenEstimator.estimateMessageTokens(null)).toBe(0);
      expect(tokenEstimator.estimateMessageTokens({ role: 'user' })).toBe(0);
      expect(tokenEstimator.estimateMessageTokens({})).toBe(0);
    });
  });
  
  describe('estimateConversationTokens', () => {
    test('should estimate tokens for an array of messages', () => {
      // Test with multiple messages
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help you?' },
        { role: 'user', content: 'I need information about windows' }
      ];
      
      // First message: 5 chars / 4 = 2 tokens + 3 role = 5 tokens
      // Second message: 28 chars / 4 = 7 tokens + 3 role = 10 tokens
      // Third message: 34 chars / 4 = 9 tokens + 3 role = 12 tokens
      // Total: 5 + 10 + 12 = 27 tokens + 10 format overhead = 37 tokens
      expect(tokenEstimator.estimateConversationTokens(messages)).toBe(37);
      
      // Test with empty array
      expect(tokenEstimator.estimateConversationTokens([])).toBe(10); // Just format overhead
      
      // Test with null or undefined
      expect(tokenEstimator.estimateConversationTokens(null)).toBe(0);
      expect(tokenEstimator.estimateConversationTokens(undefined)).toBe(0);
    });
    
    test('should handle mixed message types', () => {
      // Test with system message and regular messages
      const messages = [
        { role: 'system', content: 'Previous window specifications: Kitchen: 36×48 inches' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' }
      ];
      
      // First message: 56 chars / 4 = 14 tokens + 3 role = 17 tokens
      // Second message: 2 chars / 4 = 1 token + 3 role = 4 tokens
      // Third message: 6 chars / 4 = 2 tokens + 3 role = 5 tokens
      // Total: 17 + 4 + 5 = 26 tokens + 10 format overhead = 36 tokens
      expect(tokenEstimator.estimateConversationTokens(messages)).toBe(36);
    });
  });
});