# Testing Strategy

This document outlines the testing approach for the Window Quote WhatsApp Bot, describing the testing framework, test structure, and guidelines for creating effective tests.

## Testing Objectives

The primary objectives of our testing strategy are:

1. **Ensure Reliability**: Verify that all components work as expected under normal and abnormal conditions
2. **Prevent Regressions**: Catch issues when existing functionality is modified
3. **Validate Business Logic**: Confirm that the core business logic is correct
4. **Test External Integrations**: Verify proper handling of external APIs
5. **Improve Code Quality**: Encourage better code design through testability

## Testing Framework

We use Jest as our primary testing framework, with the following supporting tools:

- **Jest**: Main testing framework for running tests and assertions
- **Supertest**: For API endpoint testing
- **Mock Implementations**: For unit testing without external dependencies

## Test Types

### Unit Tests

- Test individual functions and methods in isolation
- Mock external dependencies and services
- Focus on testing the business logic and edge cases
- Located in `src/__tests__` directory, mirroring the source structure

### Integration Tests

- Test interactions between components
- Verify that components work together correctly
- May use in-memory databases instead of production databases
- Test API endpoints and service integrations

### Mock Strategy

To ensure tests are reliable and fast, we use the following mocking strategies:

1. **External APIs**: Mock all external API calls (Claude, WhatsApp)
2. **Database**: Use in-memory SQLite for database tests
3. **File System**: Mock file system operations for logging tests
4. **Timers**: Mock timers for testing time-based functionality

## Test File Structure

Tests are organized in the `src/__tests__` directory, mirroring the structure of the source code:

```
src/
├── __tests__/
│   ├── controllers/
│   │   ├── quoteController.test.js
│   │   └── whatsappController.test.js
│   ├── services/
│   │   ├── claudeService.test.js
│   │   ├── conversationManager.test.js
│   │   ├── quoteService.test.js
│   │   └── whatsappService.test.js
│   └── utils/
│       ├── database.test.js
│       ├── logger.test.js
│       ├── messageParser.test.js
│       ├── windowSpecParser.test.js
│       ├── tokenEstimator.test.js
│       └── contextSummarizer.test.js
```

## Test Template

Each test file should follow this structure:

```javascript
/**
 * Component Name Tests
 * 
 * Tests for [component description]
 */

// Import dependencies
const componentToTest = require('../../path/to/component');

// Mock dependencies
jest.mock('../../path/to/dependency', () => ({
  // Mock implementation
}));

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Component Name', () => {
  // Group related tests
  describe('Functionality Group', () => {
    // Individual test
    test('should perform specific action', () => {
      // Arrange: Set up test data
      
      // Act: Perform the action
      
      // Assert: Verify the results
    });
  });
});
```

## Key Components to Test

### 1. Conversation Manager

Test coverage should include:
- Conversation persistence
- Message storage and retrieval
- Window specification extraction and storage
- Context enhancement with specifications
- Conversation expiry
- Context summarization for long conversations
- Token estimation and management

#### Testing Conversation Context Enhancement

The conversation context enhancement feature requires special attention in testing due to its complexity:

1. **Test Window Specification Extraction**:
   ```javascript
   test('should extract window specifications from conversation', async () => {
     // Mock conversation with window specifications
     const messages = [
       { role: 'user', content: 'I need a window for my kitchen.' },
       { role: 'assistant', content: 'What are the dimensions?' },
       { role: 'user', content: 'It\'s 36 x 48 inches.' },
       { role: 'user', content: 'I want a standard window with double pane glass.' }
     ];

     // Mock windowSpecParser to return a valid specification
     windowSpecParser.parseWindowSpecifications.mockReturnValue({
       location: 'Kitchen',
       width: 36,
       height: 48,
       window_type: 'Standard',
       glass_type: 'Double pane',
       features: [],
       is_complete: true
     });

     // Call the function that checks for and saves specifications
     await conversationManager.checkForWindowSpecifications('test-user', messages);

     // Verify window specification was saved
     expect(mockDb.run).toHaveBeenCalledWith(
       expect.stringContaining('INSERT INTO window_specifications'),
       expect.arrayContaining(['Kitchen', 36, 48, 'Standard', 'Double pane']),
       expect.any(Function)
     );
   });
   ```

2. **Test Context Enhancement with Specifications**:
   ```javascript
   test('should enhance context with window specifications', async () => {
     // Mock getWindowSpecifications to return sample specifications
     mockDb.all.mockImplementation((query, params, callback) => {
       if (query.includes('window_specifications')) {
         callback(null, [{
           id: 1,
           conversation_id: 1,
           location: 'Kitchen',
           width: 36,
           height: 48,
           window_type: 'Standard',
           glass_type: 'Double pane',
           features: '[]',
           timestamp: new Date().toISOString()
         }]);
       } else {
         callback(null, []);
       }
     });

     // Basic messages without specifications
     const messages = [
       { role: 'user', content: 'Hello' },
       { role: 'assistant', content: 'Hi there!' }
     ];

     // Call the function
     const enhancedContext = await conversationManager.enhanceContextWithSpecifications('test-user', messages);

     // Verify a system message was added with the specifications
     expect(enhancedContext.length).toBe(messages.length + 1);
     expect(enhancedContext[0].role).toBe('system');
     expect(enhancedContext[0].content).toContain('Previous window specifications');
     expect(enhancedContext[0].content).toContain('Kitchen: 36×48 inches');
     expect(enhancedContext[0].content).toContain('Standard type');
     expect(enhancedContext[0].content).toContain('Double pane');

     // Verify original messages remain intact
     expect(enhancedContext.slice(1)).toEqual(messages);
   });
   ```

3. **Test Multiple Windows in Context**:
   ```javascript
   test('should format multiple window specifications correctly', async () => {
     // Mock getWindowSpecifications to return multiple specifications
     mockDb.all.mockImplementation((query, params, callback) => {
       if (query.includes('window_specifications')) {
         callback(null, [
           {
             id: 1,
             conversation_id: 1,
             location: 'Kitchen',
             width: 36,
             height: 48,
             window_type: 'Standard',
             glass_type: 'Double pane',
             features: '[]',
             timestamp: new Date().toISOString()
           },
           {
             id: 2,
             conversation_id: 1,
             location: 'Living Room',
             width: 60,
             height: 72,
             window_type: 'Bay',
             glass_type: 'Triple pane',
             features: '["Grilles", "Low-E glass"]',
             timestamp: new Date().toISOString()
           }
         ]);
       } else {
         callback(null, []);
       }
     });

     // Basic messages
     const messages = [{ role: 'user', content: 'Hello' }];

     // Call the function
     const enhancedContext = await conversationManager.enhanceContextWithSpecifications('test-user', messages);

     // Verify specifications are formatted with semicolons between windows
     expect(enhancedContext[0].content).toContain('Kitchen: 36×48 inches');
     expect(enhancedContext[0].content).toContain('Living Room: 60×72 inches');
     expect(enhancedContext[0].content).toContain('; '); // Separator between specifications
   });
   ```

#### Testing Context Summarization

The context summarization feature requires comprehensive testing:

1. **Test Token Estimation**:
   ```javascript
   test('should estimate token count accurately', () => {
     // Test with various text lengths
     expect(tokenEstimator.estimateTokens('Hello, world!')).toBe(4);
     expect(tokenEstimator.estimateTokens('')).toBe(0);
     
     // Test message objects
     const message = { role: 'user', content: 'Test message' };
     expect(tokenEstimator.estimateMessageTokens(message)).toBe(6);
     
     // Test conversation arrays
     const conversation = [
       { role: 'user', content: 'Hello' },
       { role: 'assistant', content: 'Hi there!' }
     ];
     expect(tokenEstimator.estimateConversationTokens(conversation)).toBe(17);
   });
   ```

2. **Test Important Message Detection**:
   ```javascript
   test('should identify messages with important window information', () => {
     // Test with window-related content
     const windowMessage = { role: 'user', content: 'I need a 36x48 window' };
     expect(contextSummarizer.isImportantMessage(windowMessage)).toBe(true);
     
     // Test with non-important content
     const greeting = { role: 'user', content: 'Hello there' };
     expect(contextSummarizer.isImportantMessage(greeting)).toBe(false);
   });
   ```

3. **Test Message Block Summarization**:
   ```javascript
   test('should generate informative summary from message block', () => {
     // Mock window specification parser
     windowSpecParser.parseWindowSpecifications.mockReturnValue({
       location: 'Kitchen',
       width: 36,
       height: 48,
       window_type: 'Standard',
       glass_type: 'Double pane',
       features: ['Grilles'],
       is_complete: true
     });
     
     // Create sample message block
     const messages = [
       { role: 'user', content: 'I need a kitchen window' },
       { role: 'assistant', content: 'What size?' },
       { role: 'user', content: '36x48 inches' },
       { role: 'assistant', content: 'What type?' },
       { role: 'user', content: 'Standard with double pane' }
     ];
     
     // Generate summary
     const summary = contextSummarizer.summarizeMessageBlock(messages);
     
     // Verify summary format and content
     expect(summary.role).toBe('system');
     expect(summary.content).toContain('Conversation summary');
     expect(summary.content).toContain('3 user messages, 2 assistant responses');
     expect(summary.content).toContain('Kitchen');
     expect(summary.content).toContain('36×48 inches');
     expect(summary.content).toContain('Standard type');
     expect(summary.content).toContain('Double pane');
     expect(summary.content).toContain('Grilles');
   });
   ```

4. **Test Context Optimization**:
   ```javascript
   test('should optimize context to stay within token limits', () => {
     // Mock token estimation
     tokenEstimator.estimateConversationTokens.mockImplementation(messages => messages.length * 300);
     tokenEstimator.estimateMessageTokens.mockImplementation(message => 300);
     
     // Create 30 messages (9000 tokens)
     const messages = Array(30).fill(null).map((_, i) => ({
       role: i % 2 === 0 ? 'user' : 'assistant',
       content: `Message ${i + 1}`
     }));
     
     // Set token limit to 3000 (should fit 10 messages)
     const optimized = contextSummarizer.optimizeContext(messages, 3000);
     
     // Expect last 10 messages to be preserved
     expect(optimized.length).toBe(10);
     expect(optimized[0].content).toBe('Message 21');
     expect(optimized[9].content).toBe('Message 30');
   });
   ```

5. **Test summarizeConversationContext Method**:
   ```javascript
   test('should preserve system messages during summarization', async () => {
     // Create context with system message and regular messages
     const context = [
       { role: 'system', content: 'Previous window specifications: Kitchen: 36×48 inches' },
       ...Array(20).fill(null).map((_, i) => ({
         role: i % 2 === 0 ? 'user' : 'assistant',
         content: `Message ${i + 1}`
       }))
     ];
     
     // Set token estimations
     tokenEstimator.estimateConversationTokens.mockReturnValueOnce(300) // System messages
       .mockReturnValueOnce(6300); // Full context
     
     // Mock optimizeContext
     contextSummarizer.optimizeContext.mockReturnValue(context.slice(-5));
     
     // Call the method
     const result = await conversationManager.summarizeConversationContext(context, 3000);
     
     // Verify system message is preserved and conversation is optimized
     expect(result.length).toBe(6); // 1 system + 5 conversation messages
     expect(result[0].role).toBe('system');
     expect(result[0].content).toContain('Previous window specifications');
   });
   ```

### 2. Claude Service

Test coverage should include:
- Retry mechanism and backoff logic
- Error handling and classification
- System prompt enhancement
- Response formatting

### 3. Logging System

Test coverage should include:
- Log level filtering
- Structured log formatting
- Log rotation
- Claude-specific logging
- PII handling

### 4. WhatsApp Controller

Test coverage should include:
- Webhook verification
- Message handling
- Error handling
- Response generation

### 5. Utility Components

Test coverage should include:
- **Token Estimator**: Verify token estimation accuracy
- **Context Summarizer**: Test summarization logic and token optimization
- **Window Spec Parser**: Validate extraction of window specifications from text

## Mock Examples

### Mocking Claude API

```javascript
// Create mock for Anthropic client
const mockCreate = jest.fn();
const MockAnthropic = jest.fn().mockImplementation(() => {
  return {
    messages: {
      create: mockCreate
    }
  };
});

// Mock the Anthropic module
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: MockAnthropic
  };
});
```

### Mocking Database

```javascript
// Create a mock SQLite database
const createMockDb = () => {
  return {
    run: jest.fn((query, params, callback) => {
      if (callback) callback.call({ lastID: 1 });
    }),
    get: jest.fn((query, params, callback) => {
      if (callback) callback(null, { id: 1, /* mock data */ });
    }),
    all: jest.fn((query, params, callback) => {
      if (callback) callback(null, [{ id: 1, /* mock data */ }]);
    }),
    close: jest.fn(callback => {
      if (callback) callback(null);
    })
  };
};

jest.mock('../../utils/database', () => ({
  getConnection: jest.fn().mockResolvedValue(createMockDb())
}));
```

### Mocking File System

```javascript
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  statSync: jest.fn().mockReturnValue({ size: 1000 }),
  appendFileSync: jest.fn(),
  promises: {
    readFile: jest.fn().mockResolvedValue('mock file content')
  }
}));
```

### Mocking Token Estimator

```javascript
jest.mock('../../utils/tokenEstimator', () => ({
  estimateTokens: jest.fn().mockImplementation(text => Math.ceil((text?.length || 0) / 4)),
  estimateMessageTokens: jest.fn().mockImplementation(() => 100),
  estimateConversationTokens: jest.fn().mockImplementation(messages => (messages?.length || 0) * 100)
}));
```

## Running Tests

Tests can be run using npm scripts:

```bash
# Run all tests
npm test

# Run tests with watch mode for development
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage Goals

We aim for the following coverage targets:

- **Overall**: At least 70% line coverage
- **Core Services**: At least 80% coverage
- **Utility Functions**: At least 90% coverage

## Implementation Status

The test coverage of key components in the project:

- ✓ Conversation Manager core functionality
- ✓ Window specification extraction and storage
- ✓ Context enhancement with specifications
- ✓ Context summarization for long conversations
- ✓ Token estimation utilities
- ✓ Claude API retry mechanisms
- ◯ Claude error handling (partial)
- ◯ Logging system (partial)
- ◯ WhatsApp controller (planned)

## Adding New Tests

When adding new functionality, follow this process:

1. Create or update test files before or alongside implementing the feature
2. Write tests for happy path scenarios first
3. Add tests for edge cases and error conditions
4. Ensure proper mocking of external dependencies
5. Run tests locally before committing

## Continuous Integration

Tests are automatically run in the CI/CD pipeline:

1. Tests run on every pull request
2. Code coverage reports are generated
3. Pull requests with failing tests cannot be merged

## Test Documentation

For complex test scenarios, include comments explaining:

1. What is being tested
2. Why specific mocks are set up a certain way
3. What edge cases are being covered

## Troubleshooting Tests

Common issues and solutions:

1. **Async Issues**: Ensure promises are properly awaited or returned
2. **Mock Cleanup**: Use `jest.clearAllMocks()` in `beforeEach`
3. **File Path Issues**: Use consistent path formats (relative vs. absolute)
4. **Timeout Errors**: For slow tests, increase timeout or mock timers