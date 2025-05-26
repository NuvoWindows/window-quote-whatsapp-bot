const RetryUtil = require('../../utils/retryUtil');

// Mock logger
jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn()
}));

describe('RetryUtil', () => {
  let retryUtil;
  
  beforeEach(() => {
    jest.clearAllMocks();
    retryUtil = new RetryUtil({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      useJitter: false // Disable jitter for predictable tests
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt if operation succeeds', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const isRetryable = jest.fn();
      
      const result = await retryUtil.executeWithRetry(
        operation,
        isRetryable,
        { operation: 'TEST_OP' }
      );
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(isRetryable).not.toHaveBeenCalled();
    });

    it('should retry on retryable errors', async () => {
      const error = new Error('Temporary failure');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      const isRetryable = jest.fn().mockReturnValue(true);
      
      const result = await retryUtil.executeWithRetry(
        operation,
        isRetryable,
        { operation: 'TEST_OP' }
      );
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(isRetryable).toHaveBeenCalledTimes(2);
      expect(isRetryable).toHaveBeenCalledWith(error);
    });

    it('should throw immediately on non-retryable errors', async () => {
      const error = new Error('Permanent failure');
      const operation = jest.fn().mockRejectedValue(error);
      const isRetryable = jest.fn().mockReturnValue(false);
      
      await expect(
        retryUtil.executeWithRetry(operation, isRetryable, { operation: 'TEST_OP' })
      ).rejects.toThrow('Permanent failure');
      
      expect(operation).toHaveBeenCalledTimes(1);
      expect(isRetryable).toHaveBeenCalledTimes(1);
      expect(error.retryInfo).toEqual({
        attempts: 1,
        exhausted: false,
        operation: 'TEST_OP'
      });
    });

    it('should exhaust retries and throw enhanced error', async () => {
      const error = new Error('Persistent failure');
      const operation = jest.fn().mockRejectedValue(error);
      const isRetryable = jest.fn().mockReturnValue(true);
      
      await expect(
        retryUtil.executeWithRetry(operation, isRetryable, { operation: 'TEST_OP' })
      ).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(isRetryable).toHaveBeenCalledTimes(4);
      expect(error.retryInfo).toEqual({
        attempts: 4,
        exhausted: true,
        operation: 'TEST_OP'
      });
    });

    it('should apply exponential backoff delays', async () => {
      const error = new Error('Temporary failure');
      const operation = jest.fn().mockRejectedValue(error);
      const isRetryable = jest.fn().mockReturnValue(true);
      
      // Mock sleep to track delays
      const sleepDelays = [];
      retryUtil.sleep = jest.fn((ms) => {
        sleepDelays.push(ms);
        return Promise.resolve();
      });
      
      await expect(
        retryUtil.executeWithRetry(operation, isRetryable, { operation: 'TEST_OP' })
      ).rejects.toThrow();
      
      // Check exponential backoff: 100ms, 200ms, 400ms
      expect(sleepDelays).toEqual([100, 200, 400]);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const util = new RetryUtil({
        baseDelayMs: 100,
        maxDelayMs: 10000,
        useJitter: false
      });
      
      expect(util.calculateBackoffDelay(1)).toBe(100);  // 100 * 2^0
      expect(util.calculateBackoffDelay(2)).toBe(200);  // 100 * 2^1
      expect(util.calculateBackoffDelay(3)).toBe(400);  // 100 * 2^2
      expect(util.calculateBackoffDelay(4)).toBe(800);  // 100 * 2^3
    });

    it('should respect maximum delay', () => {
      const util = new RetryUtil({
        baseDelayMs: 100,
        maxDelayMs: 500,
        useJitter: false
      });
      
      expect(util.calculateBackoffDelay(1)).toBe(100);
      expect(util.calculateBackoffDelay(2)).toBe(200);
      expect(util.calculateBackoffDelay(3)).toBe(400);
      expect(util.calculateBackoffDelay(4)).toBe(500); // Capped at max
      expect(util.calculateBackoffDelay(5)).toBe(500); // Still capped
    });

    it('should apply jitter when enabled', () => {
      const util = new RetryUtil({
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        useJitter: true
      });
      
      // Run multiple times to ensure jitter is applied
      const delays = new Set();
      for (let i = 0; i < 10; i++) {
        delays.add(util.calculateBackoffDelay(1));
      }
      
      // With jitter, we should get different values
      expect(delays.size).toBeGreaterThan(1);
      
      // All values should be within jitter range (75% - 125% of base)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(750);
        expect(delay).toBeLessThanOrEqual(1250);
      }
    });
  });

  describe('environment variable configuration', () => {
    it('should use environment variables when no options provided', () => {
      // Mock environment variables
      process.env.RETRY_MAX_ATTEMPTS = '5';
      process.env.RETRY_BASE_DELAY_MS = '200';
      process.env.RETRY_MAX_DELAY_MS = '5000';
      
      const util = new RetryUtil();
      
      expect(util.maxRetries).toBe(5);
      expect(util.baseDelayMs).toBe(200);
      expect(util.maxDelayMs).toBe(5000);
      
      // Clean up
      delete process.env.RETRY_MAX_ATTEMPTS;
      delete process.env.RETRY_BASE_DELAY_MS;
      delete process.env.RETRY_MAX_DELAY_MS;
    });

    it('should use defaults when environment variables not set', () => {
      const util = new RetryUtil();
      
      expect(util.maxRetries).toBe(3);
      expect(util.baseDelayMs).toBe(500);
      expect(util.maxDelayMs).toBe(10000);
    });
  });
});