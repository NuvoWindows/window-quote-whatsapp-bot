/**
 * Claude Service Tests
 * 
 * Tests the functionality of the Claude service including:
 * - API integration
 * - Retry mechanism and backoff logic
 * - Error handling
 * - System prompt enhancement
 */

// Mock dependencies
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

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logClaude: jest.fn()
}));

jest.mock('../../config/config', () => ({
  claude: {
    apiKey: 'test-api-key',
    retries: {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000
    }
  }
}));

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../../utils/logger');
const config = require('../../config/config');

// Import the claude service
// Note: We import after mocking to ensure mocks are in place
const claudeService = require('../../services/claudeService');

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset Anthropic mock behavior
  const anthropicInstance = new Anthropic();
  anthropicInstance.messages.create.mockReset();
});

describe('Claude Service', () => {
  
  // Test initialization
  test('should initialize correctly with API key and retry config', () => {
    // Verify retry configuration
    expect(claudeService.maxRetries).toBe(3);
    expect(claudeService.baseDelayMs).toBe(100);
    expect(claudeService.maxDelayMs).toBe(1000);

    // Verify Anthropic was called
    expect(MockAnthropic).toHaveBeenCalled();
  });
  
  // Test sleep function
  test('should sleep for specified duration', async () => {
    // Mock setTimeout
    jest.useFakeTimers();
    
    // Start sleep
    const sleepPromise = claudeService.sleep(500);
    
    // Advance timers
    jest.advanceTimersByTime(500);
    
    // Verify promise resolves
    await sleepPromise;
    
    // Restore timers
    jest.useRealTimers();
  });
  
  // Test backoff calculation
  test('should calculate exponential backoff delay', () => {
    // Test with different retry counts
    expect(claudeService.getBackoffDelay(0)).toBeGreaterThanOrEqual(100);
    expect(claudeService.getBackoffDelay(0)).toBeLessThanOrEqual(200); // Add 100 random jitter
    
    expect(claudeService.getBackoffDelay(1)).toBeGreaterThanOrEqual(200);
    expect(claudeService.getBackoffDelay(1)).toBeLessThanOrEqual(300);
    
    expect(claudeService.getBackoffDelay(2)).toBeGreaterThanOrEqual(400);
    expect(claudeService.getBackoffDelay(2)).toBeLessThanOrEqual(500);
    
    // Test maximum delay
    expect(claudeService.getBackoffDelay(10)).toBeLessThanOrEqual(1000); // Max delay
  });
  
  // Test error classification
  test('should correctly classify retryable errors', () => {
    // Network errors (no status)
    expect(claudeService.isRetryableError(new Error('Network error'))).toBe(true);
    
    // Authentication errors (non-retryable)
    expect(claudeService.isRetryableError({ status: 401, message: 'Unauthorized' })).toBe(false);
    expect(claudeService.isRetryableError({ status: 403, message: 'Forbidden' })).toBe(false);
    
    // Rate limit errors (retryable)
    expect(claudeService.isRetryableError({ status: 429, message: 'Too Many Requests' })).toBe(true);
    
    // Server errors (retryable)
    expect(claudeService.isRetryableError({ status: 500, message: 'Internal Server Error' })).toBe(true);
    expect(claudeService.isRetryableError({ status: 502, message: 'Bad Gateway' })).toBe(true);
    
    // Other client errors (non-retryable)
    expect(claudeService.isRetryableError({ status: 400, message: 'Bad Request' })).toBe(false);
  });
  
  // Test fallback messages
  test('should provide appropriate fallback messages for error types', () => {
    // Test with max retries
    const message1 = claudeService.getFallbackMessage(new Error('Network error'), 3);
    expect(message1).toContain('very sorry');
    expect(message1).toContain('technical difficulties');
    
    // Test authentication errors
    const message2 = claudeService.getFallbackMessage({ status: 401, message: 'Unauthorized' }, 0);
    expect(message2).toContain('unable to access');
    
    // Test rate limiting errors
    const message3 = claudeService.getFallbackMessage({ status: 429, message: 'Too Many Requests' }, 0);
    expect(message3).toContain('many requests');
    
    // Test other errors
    const message4 = claudeService.getFallbackMessage({ status: 418, message: "I'm a teapot" }, 0);
    expect(message4).toContain('trouble processing');
  });
  
  // Test generateResponse success case
  test('should successfully generate a response from Claude API', async () => {
    // Mock successful API response
    const mockResponse = {
      content: [{ text: 'This is a test response' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    };

    // Configure mock to return success on first try
    mockCreate.mockResolvedValueOnce(mockResponse);

    // Call the method
    const prompt = 'Test prompt';
    const context = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    const userInfo = { phone: '1234567890', name: 'Test User' };

    const response = await claudeService.generateResponse(prompt, context, userInfo);

    // Verify the result
    expect(response).toBe('This is a test response');

    // Verify API was called correctly
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Verify call included system prompt (contains our bot name)
    const apiCall = mockCreate.mock.calls[0][0];
    expect(apiCall.system).toBeTruthy();
    expect(apiCall.system).toContain('window quote assistant');

    // Verify context and prompt were passed correctly
    expect(apiCall.messages).toBeTruthy();
    expect(apiCall.messages.length).toBe(context.length + 1); // Context + new prompt

    // Verify logging was called
    expect(logger.info).toHaveBeenCalled();
    expect(logger.logClaude).toHaveBeenCalled();
  });
  
  // Test system message enhancement
  test('should enhance system prompt with context system messages', async () => {
    // Mock successful API response
    const mockResponse = {
      content: [{ text: 'This is a test response' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    };

    // Configure mock to return success
    mockCreate.mockResolvedValueOnce(mockResponse);

    // Call the method with a system message in context
    const prompt = 'Test prompt';
    const context = [
      { role: 'system', content: 'Previous window specifications: Kitchen: 36×48 inches, Standard type' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];

    await claudeService.generateResponse(prompt, context);

    // Verify API was called
    expect(mockCreate).toHaveBeenCalled();

    // Get the API call arguments
    const apiCall = mockCreate.mock.calls[0][0];

    // Verify system message contains both the specified content and bot instructions
    expect(apiCall.system).toContain('Previous window specifications');
    expect(apiCall.system).toContain('window quote assistant');

    // Verify system message was removed from messages array
    const messagesPassedToAPI = apiCall.messages;
    const hasSystemMessage = messagesPassedToAPI.some(msg => msg.role === 'system');
    expect(hasSystemMessage).toBe(false);
  });
  
  // Test retry mechanism
  test('should retry on retryable errors', async () => {
    // Mock responses - first fail with retryable error, then succeed
    const mockError = { status: 429, message: 'Too Many Requests' };
    const mockResponse = {
      content: [{ text: 'This is a test response after retry' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    };

    // Reset mocks
    mockCreate.mockReset();

    // Configure mock behavior - first reject, then resolve
    mockCreate
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(mockResponse);

    // Spy on sleep method to avoid actual waiting
    jest.spyOn(claudeService, 'sleep').mockResolvedValue();

    // Call the method
    const prompt = 'Test prompt';
    const response = await claudeService.generateResponse(prompt);

    // Verify the result
    expect(response).toBe('This is a test response after retry');

    // Verify API was called twice
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify logging of retry occurred
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.logClaude).toHaveBeenCalled();
  });
  
  // Test maximum retries exceeded
  test('should return fallback message when max retries exceeded', async () => {
    // Mock responses - all fail with retryable errors
    const mockError = { status: 500, message: 'Internal Server Error' };

    // Reset and configure mock to always fail
    mockCreate.mockReset();
    for (let i = 0; i <= claudeService.maxRetries; i++) {
      mockCreate.mockRejectedValueOnce(mockError);
    }

    // Spy on sleep method to avoid actual waiting
    jest.spyOn(claudeService, 'sleep').mockResolvedValue();

    // Call the method
    const prompt = 'Test prompt';
    const response = await claudeService.generateResponse(prompt);

    // Verify the result is a fallback message
    expect(response).toContain('technical difficulties');

    // Verify error logging happened
    expect(logger.error).toHaveBeenCalled();
    expect(logger.logClaude).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error'
    }));
  });

  // Test non-retryable error
  test('should not retry non-retryable errors', async () => {
    // Mock responses - non-retryable authentication error
    const mockError = { status: 401, message: 'Unauthorized' };

    // Reset and configure mock
    mockCreate.mockReset();
    mockCreate.mockRejectedValueOnce(mockError);

    // Spy on isRetryableError to verify it's called
    jest.spyOn(claudeService, 'isRetryableError');

    // Call the method
    const prompt = 'Test prompt';
    const response = await claudeService.generateResponse(prompt);

    // Verify isRetryableError was called
    expect(claudeService.isRetryableError).toHaveBeenCalledWith(mockError);

    // Verify error logging happened
    expect(logger.error).toHaveBeenCalled();
    expect(logger.logClaude).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      error_status: 401
    }));
  });
});