/**
 * Conversation Manager Service Tests
 * 
 * Tests the functionality of the conversation manager including:
 * - Conversation persistence
 * - Message storage and retrieval
 * - Window specification extraction and storage
 * - Context enhancement with specifications
 * - Context summarization for long conversations
 */

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logClaude: jest.fn()
}));

jest.mock('../../utils/database', () => ({
  getConnection: jest.fn()
}));

jest.mock('../../utils/windowSpecParser', () => ({
  parseWindowSpecifications: jest.fn()
}));

jest.mock('../../utils/tokenEstimator', () => ({
  estimateTokens: jest.fn(),
  estimateMessageTokens: jest.fn(),
  estimateConversationTokens: jest.fn()
}));

jest.mock('../../utils/contextSummarizer', () => ({
  optimizeContext: jest.fn()
}));

const logger = require('../../utils/logger');
const database = require('../../utils/database');
const windowSpecParser = require('../../utils/windowSpecParser');
const tokenEstimator = require('../../utils/tokenEstimator');
const contextSummarizer = require('../../utils/contextSummarizer');

// Create a mock SQLite database for testing
const createMockDb = () => {
  // Mock database methods
  return {
    run: jest.fn((query, params, callback) => {
      if (callback) {
        callback.call({ lastID: 1 });
      }
    }),
    get: jest.fn((query, params, callback) => {
      if (callback) {
        if (query.includes('SELECT * FROM conversations')) {
          callback(null, { 
            id: 1, 
            user_id: 'test-user', 
            user_name: 'Test User',
            last_active: new Date().toISOString(),
            created_at: new Date().toISOString(),
            expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            metadata: '{}'
          });
        } else {
          callback(null, null);
        }
      }
    }),
    all: jest.fn((query, params, callback) => {
      if (callback) {
        if (query.includes('SELECT * FROM messages')) {
          const mockMessages = [
            { 
              id: 1, 
              conversation_id: 1, 
              role: 'user', 
              content: 'Hello', 
              timestamp: new Date(Date.now() - 1000).toISOString() 
            },
            { 
              id: 2, 
              conversation_id: 1, 
              role: 'assistant', 
              content: 'Hi there!', 
              timestamp: new Date().toISOString() 
            }
          ];
          callback(null, mockMessages);
        } else if (query.includes('SELECT * FROM window_specifications')) {
          const mockSpecs = [
            {
              id: 1,
              conversation_id: 1,
              location: 'Kitchen',
              width: 36,
              height: 48,
              window_type: 'Standard',
              glass_type: 'Double pane',
              features: '["Grilles"]',
              timestamp: new Date().toISOString()
            }
          ];
          callback(null, mockSpecs);
        } else if (query.includes('SELECT c.*, COUNT(m.id)')) {
          // Mock for listActiveConversations
          const mockConversations = [
            { 
              id: 1, 
              user_id: 'test-user', 
              user_name: 'Test User',
              last_active: new Date().toISOString(),
              created_at: new Date().toISOString(),
              expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              metadata: '{}',
              message_count: 2
            }
          ];
          callback(null, mockConversations);
        } else {
          callback(null, []);
        }
      }
    }),
    exec: jest.fn((query, callback) => {
      if (callback) {
        callback(null);
      }
    }),
    close: jest.fn((callback) => {
      if (callback) {
        callback(null);
      }
    })
  };
};

// Setup the mock database connection
const mockDb = createMockDb();
database.getConnection.mockResolvedValue(mockDb);

// Import the conversation manager
// Note: We import after mocking to ensure mocks are in place
const conversationManager = require('../../services/conversationManager');

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset the initialization state of conversation manager
  conversationManager.initialized = false;
  conversationManager.db = null;
});

describe('Conversation Manager', () => {

  // Configure token estimation before tests
  beforeEach(() => {
    // Reset token estimator mock
    tokenEstimator.estimateConversationTokens.mockReset();
    
    // Default implementation returns length * 300 tokens
    tokenEstimator.estimateConversationTokens.mockImplementation((messages) => {
      return (messages?.length || 0) * 300;
    });
    
    // Default implementation for context summarizer
    contextSummarizer.optimizeContext.mockImplementation((messages, maxTokens) => {
      // Return the last N messages that would fit in maxTokens
      const maxMessages = Math.floor(maxTokens / 300);
      return messages ? messages.slice(-maxMessages) : [];
    });
  });
  
  // Test initialization
  test('should initialize correctly', async () => {
    // Ensure the database is initialized
    await conversationManager.init();
    
    // Verify database connection was requested
    expect(database.getConnection).toHaveBeenCalled();
    
    // Verify initialization state
    expect(conversationManager.initialized).toBe(true);
    expect(conversationManager.db).toBeTruthy();
    
    // Verify logger was called
    expect(logger.info).toHaveBeenCalledWith('Conversation manager initialized successfully');
  });
  
  // Test getOrCreateConversation
  test('should get existing conversation', async () => {
    // Set up the mock to return an existing conversation
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, { 
        id: 1, 
        user_id: 'test-user', 
        user_name: 'Test User', 
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: '{}'
      });
    });
    
    // Call the method
    const conversation = await conversationManager.getOrCreateConversation('test-user', 'Test User');
    
    // Verify the result
    expect(conversation).toBeTruthy();
    expect(conversation.id).toBe(1);
    expect(conversation.user_id).toBe('test-user');
    
    // Verify database queries
    expect(mockDb.get).toHaveBeenCalled();
    expect(mockDb.run).toHaveBeenCalled(); // For updating last_active
  });
  
  test('should create new conversation if not exists', async () => {
    // Set up the mock to return no existing conversation
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, null);
    });
    
    // Call the method
    const conversation = await conversationManager.getOrCreateConversation('new-user', 'New User');
    
    // Verify the result
    expect(conversation).toBeTruthy();
    expect(conversation.user_id).toBe('new-user');
    
    // Verify database queries
    expect(mockDb.get).toHaveBeenCalled();
    expect(mockDb.run).toHaveBeenCalled(); // For inserting new conversation
  });
  
  // Test addMessage
  test('should add message to conversation', async () => {
    // Call the method
    const message = await conversationManager.addMessage('test-user', 'user', 'Test message');
    
    // Verify the result
    expect(message).toBeTruthy();
    expect(message.role).toBe('user');
    expect(message.content).toBe('Test message');
    
    // Verify database query
    expect(mockDb.run).toHaveBeenCalled();
    // Get the INSERT INTO messages query call
    const runCalls = mockDb.run.mock.calls;
    const messageInsertCall = runCalls.find(call => call[0].includes('INSERT INTO messages'));

    expect(messageInsertCall).toBeTruthy();
    expect(messageInsertCall[1]).toContain('Test message');
  });
  
  // Test getConversationContext
  test('should retrieve and format conversation context', async () => {
    // Setup window parser mock
    windowSpecParser.parseWindowSpecifications.mockReturnValue({
      location: 'Kitchen',
      width: 36,
      height: 48,
      window_type: 'Standard',
      glass_type: 'Double pane',
      features: ['Grilles'],
      is_complete: true
    });
    
    // Call the method
    const context = await conversationManager.getConversationContext('test-user');
    
    // Verify the result
    expect(context).toBeTruthy();
    expect(Array.isArray(context)).toBe(true);
    expect(context.length).toBeGreaterThan(0);
    
    // Verify the context has been enhanced with window specifications
    const hasSpecsMessage = context.some(msg => 
      msg.role === 'system' && msg.content.includes('Previous window specifications')
    );
    expect(hasSpecsMessage).toBe(true);
    
    // Verify database query
    expect(mockDb.all).toHaveBeenCalled();
    // The query should select from messages table
    const allCall = mockDb.all.mock.calls[0];
    expect(allCall[0]).toContain('SELECT * FROM messages');
  });
  
  // Test saveWindowSpecification
  test('should save window specification', async () => {
    // Call the method
    const spec = {
      location: 'Living Room',
      width: 60,
      height: 72,
      window_type: 'Bay',
      glass_type: 'Triple pane',
      features: ['Low-E glass', 'Grilles']
    };
    
    const savedSpec = await conversationManager.saveWindowSpecification('test-user', spec);
    
    // Verify the result
    expect(savedSpec).toBeTruthy();
    expect(savedSpec.location).toBe('Living Room');
    expect(savedSpec.width).toBe(60);
    expect(savedSpec.height).toBe(72);
    
    // Verify database query
    expect(mockDb.run).toHaveBeenCalled();
    // The query should insert into window_specifications
    const runCalls = mockDb.run.mock.calls;
    const specInsertCall = runCalls.find(call => call[0].includes('INSERT INTO window_specifications'));

    expect(specInsertCall).toBeTruthy();
  });
  
  // Test getWindowSpecifications
  test('should retrieve window specifications', async () => {
    // Call the method
    const specs = await conversationManager.getWindowSpecifications('test-user');
    
    // Verify the result
    expect(specs).toBeTruthy();
    expect(Array.isArray(specs)).toBe(true);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs[0].location).toBe('Kitchen');
    
    // Verify features were parsed from JSON
    expect(Array.isArray(specs[0].features)).toBe(true);
    
    // Verify database query
    expect(mockDb.all).toHaveBeenCalled();
    // The query should select from window_specifications
    const allCall = mockDb.all.mock.calls.find(call => call[0].includes('window_specifications'));
    expect(allCall[0]).toContain('SELECT * FROM window_specifications');
  });
  
  // Test enhanceContextWithSpecifications
  test('should enhance context with window specifications', async () => {
    // Mock messages
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    // Call the method
    const enhancedContext = await conversationManager.enhanceContextWithSpecifications('test-user', messages);
    
    // Verify the result
    expect(enhancedContext).toBeTruthy();
    expect(Array.isArray(enhancedContext)).toBe(true);
    expect(enhancedContext.length).toBe(messages.length + 1); // +1 for the system message
    
    // Check for system message with specifications
    const systemMessage = enhancedContext.find(msg => msg.role === 'system');
    expect(systemMessage).toBeTruthy();
    expect(systemMessage.content).toContain('Previous window specifications');
    expect(systemMessage.content).toContain('Kitchen');
    expect(systemMessage.content).toContain('36×48');
  });
  
  // Test listActiveConversations
  test('should list active conversations', async () => {
    // Call the method
    const conversations = await conversationManager.listActiveConversations();
    
    // Verify the result
    expect(conversations).toBeTruthy();
    expect(Array.isArray(conversations)).toBe(true);
    expect(conversations.length).toBeGreaterThan(0);
    expect(conversations[0].user_id).toBe('test-user');
    expect(conversations[0].message_count).toBe(2);
    
    // Verify database query
    expect(mockDb.all).toHaveBeenCalled();
    // The query should join conversations and messages
    const allCall = mockDb.all.mock.calls.find(call => call[0].includes('SELECT c.*, COUNT(m.id)'));
    expect(allCall[0]).toContain('FROM conversations c');
    expect(allCall[0]).toContain('LEFT JOIN messages m');
  });
  
  // Test deleteConversation
  test('should delete a conversation', async () => {
    // Setup mock to indicate deletion occurred
    mockDb.run.mockImplementation((query, params, callback) => {
      if (callback) {
        callback.call({ changes: 1 }); // Indicate 1 row was deleted
      }
    });
    
    // Call the method
    const result = await conversationManager.deleteConversation('test-user');
    
    // Verify the result
    expect(result).toBe(true);
    
    // Verify database query
    expect(mockDb.run).toHaveBeenCalled();
    const runCall = mockDb.run.mock.calls.find(call => call[0].includes('DELETE FROM conversations'));
    expect(runCall[0]).toContain('DELETE FROM conversations');
    expect(runCall[1][0]).toBe('test-user');
  });
  
  // Test expireOldConversations
  test('should expire old conversations', async () => {
    // Setup mock to indicate expiration occurred
    mockDb.run.mockImplementation((query, params, callback) => {
      if (callback) {
        callback.call({ changes: 2 }); // Indicate 2 rows were deleted
      }
    });
    
    // Call the method
    const count = await conversationManager.expireOldConversations();
    
    // Verify the result
    expect(count).toBe(2);
    
    // Verify database query
    expect(mockDb.run).toHaveBeenCalled();
    const runCall = mockDb.run.mock.calls.find(call => call[0].includes('DELETE FROM conversations'));
    expect(runCall[0]).toContain('DELETE FROM conversations WHERE expire_at <');
  });
  
  // Test close method
  test('should close database connection', async () => {
    // Ensure initialized
    await conversationManager.init();
    
    // Call the method
    await conversationManager.close();
    
    // Verify database close was called
    expect(mockDb.close).toHaveBeenCalled();
    expect(conversationManager.initialized).toBe(false);
  });
  
  // Context Summarization Tests
  describe('Context Summarization', () => {
    // Test summarizeConversationContext method
    test('should summarize regular conversation context', async () => {
      // Initialize conversation manager
      await conversationManager.init();
      
      // Create sample context with 20 messages (6000 tokens)
      const context = Array(20).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      
      // Mock tokenEstimator for system messages (empty array)
      tokenEstimator.estimateConversationTokens
        .mockReturnValueOnce(0)  // First call: system messages token count
        .mockReturnValueOnce(3000); // Second call: final optimized context token count
      
      // Set expected optimized context (10 messages that fit in 3000 tokens)
      const expectedOptimized = context.slice(-10);
      contextSummarizer.optimizeContext.mockReturnValueOnce(expectedOptimized);
      
      // Call the method
      const result = await conversationManager.summarizeConversationContext(context, 3000);
      
      // Verify results
      expect(result).toEqual(expectedOptimized);
      // The manager separates system messages (none in this case) from conversation messages
      // So it passes the conversation context and remaining tokens (3000 - 0 = 3000)
      expect(contextSummarizer.optimizeContext).toHaveBeenCalledWith(context, 3000);
      expect(tokenEstimator.estimateConversationTokens).toHaveBeenCalledTimes(2);
    });
    
    test('should handle context with system messages', async () => {
      // Initialize conversation manager
      await conversationManager.init();
      
      // Create sample context with system message and 10 regular messages
      const context = [
        { role: 'system', content: 'Previous window specifications: Kitchen: 36×48 inches' },
        ...Array(10).fill(null).map((_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`
        }))
      ];
      
      // Set token counts
      tokenEstimator.estimateConversationTokens
        .mockReturnValueOnce(300) // For system messages
        .mockReturnValueOnce(3300); // For final context
      
      // Set expected optimized context
      const regularOptimized = context.slice(1).slice(-5); // Last 5 regular messages
      const expectedOptimized = [context[0], ...regularOptimized];
      contextSummarizer.optimizeContext.mockReturnValueOnce(regularOptimized);
      
      // Call the method
      const result = await conversationManager.summarizeConversationContext(context, 2000);
      
      // Verify results
      expect(result).toEqual(expectedOptimized);
      expect(contextSummarizer.optimizeContext).toHaveBeenCalledWith(
        context.slice(1), // Non-system messages
        1700 // 2000 - 300 system message tokens
      );
    });
    
    test('should handle errors during summarization', async () => {
      // Initialize conversation manager
      await conversationManager.init();
      
      // Create sample context with 10 messages
      const context = Array(10).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      
      // Force an error in optimizeContext
      contextSummarizer.optimizeContext.mockImplementationOnce(() => {
        throw new Error('Summarization error');
      });
      
      // Call the method
      const result = await conversationManager.summarizeConversationContext(context, 2000);
      
      // Verify error handling
      expect(result).toEqual(context.slice(-10)); // Default truncation
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error summarizing conversation context'),
        expect.any(Object)
      );
    });
    
    // Test getConversationContext with summarization
    test('should optimize context when token count exceeds limit', async () => {
      // Initialize conversation manager
      await conversationManager.init();
      
      // Spy on enhanceContextWithSpecifications
      const originalEnhance = conversationManager.enhanceContextWithSpecifications;
      
      // Mock enhanceContextWithSpecifications to return enhanced context
      const enhancedContext = [
        { role: 'system', content: 'Previous window specifications: Kitchen: 36×48 inches' },
        ...Array(20).fill(null).map((_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`
        }))
      ];
      conversationManager.enhanceContextWithSpecifications = jest.fn().mockResolvedValue(enhancedContext);
      
      // Mock database to return messages (doesn't matter what messages since we'll override enhanceContextWithSpecifications)
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [{ id: 1, conversation_id: 1, role: 'user', content: 'Test', timestamp: new Date().toISOString() }]);
      });
      
      // Set token estimator to indicate context is too large
      tokenEstimator.estimateConversationTokens.mockReturnValueOnce(9000); // Above 8000 limit
      
      // Set up expected optimized context
      const optimizedContext = [
        { role: 'system', content: 'Previous window specifications: Kitchen: 36×48 inches' },
        ...Array(10).fill(null).map((_, i) => ({
          role: (i + 10) % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 11}` // Last 10 messages
        }))
      ];
      
      // Mock summarizeConversationContext
      const originalSummarize = conversationManager.summarizeConversationContext;
      conversationManager.summarizeConversationContext = jest.fn().mockResolvedValue(optimizedContext);
      
      // Call the method
      const result = await conversationManager.getConversationContext('test-user');
      
      // Verify results
      expect(result).toEqual(optimizedContext);
      expect(tokenEstimator.estimateConversationTokens).toHaveBeenCalledWith(enhancedContext);
      expect(conversationManager.summarizeConversationContext).toHaveBeenCalledWith(
        enhancedContext,
        8000 // MAX_TOKEN_ESTIMATE
      );
      
      // Restore original methods
      conversationManager.enhanceContextWithSpecifications = originalEnhance;
      conversationManager.summarizeConversationContext = originalSummarize;
    });
    
    test('should return normal context when under token limit', async () => {
      // Initialize conversation manager
      await conversationManager.init();
      
      // Spy on enhanceContextWithSpecifications
      const originalEnhance = conversationManager.enhanceContextWithSpecifications;
      
      // Set up enhanceContextWithSpecifications to return a small context
      const enhancedContext = Array(5).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));
      conversationManager.enhanceContextWithSpecifications = jest.fn().mockResolvedValue(enhancedContext);
      
      // Mock database to return messages (doesn't matter what messages since we'll override enhanceContextWithSpecifications)
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [{ id: 1, conversation_id: 1, role: 'user', content: 'Test', timestamp: new Date().toISOString() }]);
      });
      
      // Set token estimator to indicate context is small enough
      tokenEstimator.estimateConversationTokens.mockReturnValueOnce(1500); // Below 8000 limit
      
      // Call the method
      const result = await conversationManager.getConversationContext('test-user');
      
      // Verify results
      expect(result).toEqual(enhancedContext);
      expect(tokenEstimator.estimateConversationTokens).toHaveBeenCalledWith(enhancedContext);
      // The actual log message from the code
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Context within token limits \(\d+ <= \d+\)/)
      );
      
      // Restore original method
      conversationManager.enhanceContextWithSpecifications = originalEnhance;
    });
  });
});