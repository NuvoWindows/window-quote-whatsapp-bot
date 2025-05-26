/**
 * Multi-Window Quote Service Tests
 */

// Mock sqlite3 before any requires to prevent binding issues
jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: jest.fn()
  })
}));

// Mock the database module
jest.mock('../../utils/database', () => ({
  getDatabase: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  }))
}));

const multiWindowQuoteService = require('../../services/multiWindowQuoteService');
const quoteModel = require('../../models/quoteModel');

// Mock dependencies
jest.mock('../../models/quoteModel');
jest.mock('../../services/quoteService', () => ({
  calculateDetailedQuote: jest.fn().mockImplementation((specs) => ({
    window: {
      dimensions: {
        width: specs.width,
        height: specs.height,
        squareFootage: 10
      },
      type: specs.type || 'standard',
      operationType: specs.operationType || 'Hung',
      paneCount: specs.paneCount || 2,
      options: specs.options || {}
    },
    pricing: {
      basePrice: 350,
      optionsPrice: { glassType: 0, paneCount: 0, lowE: 0, grilles: 0 },
      windowSubtotal: 400,
      installationCost: 150,
      total: 550,
      bayWindowCost: specs.type === 'bay' ? { headerFooter: 175, siding: 100 } : undefined,
      shapedWindowCost: specs.type === 'shaped' ? 250 : undefined
    }
  }))
}));

// Mock fs and path for file operations
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));
jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mocked/path'),
  dirname: jest.fn().mockReturnValue('/mocked/dir')
}));

describe('MultiWindowQuoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    quoteModel.createQuote.mockResolvedValue({ id: 1, status: 'draft' });
    quoteModel.getQuoteById.mockResolvedValue({
      id: 1,
      status: 'draft',
      windows: [
        {
          window_id: 1,
          width: 36,
          height: 48,
          square_footage: 12,
          type: 'standard',
          operation_type: 'Hung'
        }
      ]
    });
    quoteModel.updateQuote.mockResolvedValue(true);
    quoteModel.addWindowToQuote.mockResolvedValue({
      window_id: 2,
      quote_id: 1,
      width: 24,
      height: 36
    });
    quoteModel.addQuoteFile.mockResolvedValue({ id: 1 });
  });
  
  describe('createQuote', () => {
    it('should create a new quote', async () => {
      const result = await multiWindowQuoteService.createQuote({
        customer_name: 'Test Customer',
        customer_id: '+1234567890'
      });
      
      expect(quoteModel.createQuote).toHaveBeenCalledWith(expect.objectContaining({
        customer_name: 'Test Customer',
        customer_id: '+1234567890',
        status: 'draft'
      }));
      expect(result).toEqual({ id: 1, status: 'draft' });
    });
    
    it('should handle error during quote creation', async () => {
      quoteModel.createQuote.mockRejectedValue(new Error('DB error'));
      
      await expect(multiWindowQuoteService.createQuote({}))
        .rejects.toThrow('Failed to create quote: DB error');
    });
  });
  
  describe('addWindowToQuote', () => {
    it('should add a window to an existing quote', async () => {
      const windowSpecs = {
        width: 24,
        height: 36,
        type: 'standard',
        operation_type: 'Hung'
      };
      
      const result = await multiWindowQuoteService.addWindowToQuote(1, windowSpecs);
      
      expect(quoteModel.addWindowToQuote).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        window_id: 2,
        quote_id: 1
      }));
    });
    
    it('should handle error when quote does not exist', async () => {
      quoteModel.getQuoteById.mockResolvedValue(null);
      
      await expect(multiWindowQuoteService.addWindowToQuote(999, { width: 24, height: 36 }))
        .rejects.toThrow('Quote 999 not found');
    });
    
    it('should update quote status to revision if it was complete', async () => {
      // Mock the quote before adding window (first call)
      // Then mock it after adding window (second call for generateQuoteFile)
      quoteModel.getQuoteById
        .mockResolvedValueOnce({
          id: 1,
          status: 'complete',
          windows: []
        })
        .mockResolvedValueOnce({
          id: 1,
          status: 'revision',
          windows: [{
            window_id: 1,
            width: 24,
            height: 36,
            window_type: 'standard',
            operation_type: 'Hung',
            square_footage: 6,
            base_price: 300,
            window_subtotal: 350,
            installation_price: 150
          }]
        });
      
      // Mock addWindowToQuote to return the added window
      quoteModel.addWindowToQuote.mockResolvedValue({
        window_id: 1,
        quote_id: 1,
        width: 24,
        height: 36
      });
      
      await multiWindowQuoteService.addWindowToQuote(1, { width: 24, height: 36 });
      
      expect(quoteModel.updateQuote).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'revision'
      }));
    });
  });
  
  describe('completeQuote', () => {
    it('should complete a quote with windows', async () => {
      const result = await multiWindowQuoteService.completeQuote(1);
      
      expect(quoteModel.updateQuote).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'complete'
      }));
      expect(quoteModel.addQuoteFile).toHaveBeenCalled();
    });
    
    it('should reject if quote has no windows', async () => {
      quoteModel.getQuoteById.mockResolvedValue({
        id: 1,
        status: 'draft',
        windows: []
      });
      
      await expect(multiWindowQuoteService.completeQuote(1))
        .rejects.toThrow('Cannot complete a quote with no windows');
    });
  });
  
  describe('generateQuoteFile', () => {
    it('should generate an HTML file for a quote', async () => {
      const result = await multiWindowQuoteService.generateQuoteFile(1);
      
      expect(result).toEqual(expect.objectContaining({
        success: true,
        quote_id: 1
      }));
      expect(quoteModel.addQuoteFile).toHaveBeenCalled();
    });
  });
  
  // Additional test cases would cover:
  // - updateWindow
  // - removeWindow
  // - getQuoteByWindowId
  // - createQuoteFromConversation
});