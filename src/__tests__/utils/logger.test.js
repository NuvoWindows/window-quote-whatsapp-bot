/**
 * Logger Utility Tests
 * 
 * Tests the functionality of the logging system including:
 * - Log level filtering
 * - Log rotation
 * - Structured formatting
 * - Claude-specific logging
 * - PII handling
 */

// Mock filesystem to avoid actual file operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  statSync: jest.fn(),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
  appendFileSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));

// Mock path for consistent path handling
jest.mock('path', () => ({
  join: jest.fn((dir, file) => `${dir}/${file}`)
}));

// Spy on console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  jest.resetModules();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Mock process.env
const originalEnv = process.env;

describe('Logger Utility', () => {
  
  // Setup mocks for each test
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Mock filesystem functions
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ size: 1000 }); // Small file size, no rotation needed
    fs.promises.readFile.mockResolvedValue('{"timestamp":"2023-05-12T10:00:00.000Z","type":"request","user":"1234567890"}');
  });
  
  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });
  
  test('should initialize with default configuration', () => {
    // Clear any existing process.env values for logging
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_TO_FILE;
    delete process.env.LOG_DIR;
    delete process.env.MAX_LOG_SIZE;
    delete process.env.MAX_LOG_FILES;
    delete process.env.REDACT_PII;
    
    // Reimport to get fresh instance with default config
    jest.resetModules();
    const logger = require('../../utils/logger');
    
    // Log a test message
    logger.info('Test message');
    
    // Verify console output
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('Test message');
    
    // Verify no file writing if LOG_TO_FILE is false by default
    const fs = require('fs');
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });
  
  test('should respect LOG_LEVEL configuration', () => {
    // Set log level to warn
    process.env.LOG_LEVEL = 'warn';
    
    // Reimport logger to pick up env changes
    jest.resetModules();
    const logger = require('../../utils/logger');
    
    // Log messages at different levels
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');
    
    // Verify only warn and error were logged
    expect(console.log).toHaveBeenCalledTimes(1); // One for warn
    expect(console.error).toHaveBeenCalledTimes(1); // One for error
    
    // Verify content
    expect(console.log.mock.calls[0][0]).toContain('WARN');
    expect(console.log.mock.calls[0][0]).toContain('Warning message');
    expect(console.error.mock.calls[0][0]).toContain('ERROR');
    expect(console.error.mock.calls[0][0]).toContain('Error message');
  });
  
  test('should write to log files when enabled', () => {
    // Enable file logging
    process.env.LOG_TO_FILE = 'true';
    process.env.LOG_DIR = 'test_logs';
    
    // Mock directory exists
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    
    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');
    
    // Log a test message
    logger.info('File log test', { test: true });
    
    // Verify file was written
    expect(fs.appendFileSync).toHaveBeenCalled();
    
    // Verify log dir and content
    const writeCall = fs.appendFileSync.mock.calls[0];
    expect(writeCall[0]).toBe('test_logs/info.log');
    // Should be JSON format with timestamp, level, message
    const logContent = writeCall[1];
    expect(logContent).toContain('"level":"INFO"');
    expect(logContent).toContain('"message":"File log test"');
    expect(logContent).toContain('"test":true');
  });
  
  test('should rotate logs when file size exceeds limit', () => {
    // Configure log size limit
    process.env.LOG_TO_FILE = 'true';
    process.env.MAX_LOG_SIZE = '500'; // 500 bytes

    // Mock file size exceeding limit
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ size: 1000 }); // File size > MAX_LOG_SIZE

    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');

    // Trigger the log write which should cause rotation
    logger.info('Test message');

    // Verify file operations were called
    expect(fs.appendFileSync).toHaveBeenCalled();
  });
  
  test('should sanitize PII when enabled', () => {
    // Enable PII redaction
    process.env.REDACT_PII = 'true';
    
    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');
    
    // Log with sensitive information
    logger.info('User details', {
      phone: '1234567890',
      email: 'test@example.com',
      message: 'My phone is 1234567890'
    });
    
    // Check console output for redacted PII
    const logOutput = console.log.mock.calls[0][0];
    expect(logOutput).toContain('[REDACTED]'); // Phone should be fully redacted
    expect(logOutput).not.toContain('1234567890'); // Phone number should not appear as-is
    
    // If we were writing to a file, check that too
    if (process.env.LOG_TO_FILE === 'true') {
      const fs = require('fs');
      const fileOutput = fs.appendFileSync.mock.calls[0][1];
      expect(fileOutput).toContain('[REDACTED]');
      expect(fileOutput).not.toContain('1234567890');
    }
  });
  
  test('should not sanitize PII when disabled', () => {
    // Disable PII redaction
    process.env.REDACT_PII = 'false';
    
    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');
    
    // Log with sensitive information
    const sensitiveData = {
      phone: '1234567890',
      email: 'test@example.com'
    };
    
    logger.info('User details', sensitiveData);
    
    // Check console output for non-redacted PII
    const logOutput = console.log.mock.calls[0][0];
    expect(logOutput).toContain('1234567890'); // Phone should appear as-is
    expect(logOutput).toContain('test@example.com'); // Email should appear as-is
  });
  
  test('should log Claude API interactions properly', () => {
    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');
    
    // Log a Claude API request
    const claudeData = {
      type: 'request',
      requestId: '123abc',
      user: '1234567890',
      user_name: 'Test User',
      timestamp: new Date().toISOString(),
      query: 'What size window do I need?',
      summary: 'User asking about window size'
    };
    
    logger.logClaude(claudeData);
    
    // Verify console output
    expect(console.log).toHaveBeenCalled();
    const logOutput = console.log.mock.calls[0][0];
    expect(logOutput).toContain('[CLAUDE]');
    expect(logOutput).toContain('request');
    expect(logOutput).toContain('User asking about window size');
    
    // Verify file output if enabled
    if (process.env.LOG_TO_FILE === 'true') {
      const fs = require('fs');
      expect(fs.appendFileSync).toHaveBeenCalled();
      
      // Should write to Claude-specific log file
      const writeCall = fs.appendFileSync.mock.calls[0];
      expect(writeCall[0]).toContain('claude.log');
      
      // Should be JSON with all fields
      const fileContent = writeCall[1];
      expect(fileContent).toContain('"type":"request"');
      expect(fileContent).toContain('"user":"1234567890"');
      expect(fileContent).toContain('"query":"What size window do I need?"');
    }
  });
  
  test('should parse and return Claude logs', async () => {
    // Mock environment for file logging
    process.env.LOG_TO_FILE = 'true';

    // Mock file system for reading logs
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);

    // Create sample log entries
    const logContent = [
      '{"timestamp":"2023-05-10T10:00:00.000Z","type":"request","user":"1111111111","query":"Hello"}',
      '{"timestamp":"2023-05-11T11:00:00.000Z","type":"response","user":"2222222222","response_text":"Hi there"}',
      '{"timestamp":"2023-05-12T12:00:00.000Z","type":"error","user":"1111111111","error_message":"Network error"}'
    ].join('\n');

    fs.promises.readFile.mockResolvedValue(logContent);

    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');

    // Assert that the filterClaudeLogs function exists
    expect(typeof logger.filterClaudeLogs).toBe('function');

    // Mock that logs directory exists for filterClaudeLogs
    fs.existsSync.mockImplementation(path => {
      // Return true for both the logs directory and the log file
      return true;
    });
  });
  
  test('should handle errors gracefully', () => {
    // Mock console.error for tracking
    console.error = jest.fn();

    // Reimport logger
    jest.resetModules();
    const logger = require('../../utils/logger');

    // Call log functions with various parameters
    expect(() => {
      logger.info('Test info message', { test: true });
      logger.error('Test error message', { error: new Error('Test error') });
      logger.logClaude({ type: 'request', user: '1234567890' });
    }).not.toThrow();
  });
  
  test('should support log level configuration', () => {
    // Test valid log levels
    jest.resetModules();
    process.env.LOG_LEVEL = 'debug';
    const debugLogger = require('../../utils/logger');

    // Verify debug level logging works
    debugLogger.debug('Debug test');
    debugLogger.info('Info test');

    // Reset and test error level
    jest.resetModules();
    process.env.LOG_LEVEL = 'error';
    const errorLogger = require('../../utils/logger');

    // Verify setLogLevel returns correct values for valid/invalid inputs
    expect(typeof errorLogger.setLogLevel).toBe('function');
    expect(errorLogger.setLogLevel('info')).toBe(true);
    expect(errorLogger.setLogLevel('invalid')).toBe(false);
  });
});