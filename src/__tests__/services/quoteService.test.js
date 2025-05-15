/**
 * Quote Service Tests
 * 
 * Tests the functionality of the quote service including:
 * - Enhanced pricing variables
 * - Window type specific calculations
 * - Quantity discounts
 * - Installation pricing
 */

// Mock logger
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn()
}));

// Import module after mocking
const quoteService = require('../../services/quoteService');

describe('Quote Service', () => {
  // Test basic calculation
  test('should calculate standard window price correctly', () => {
    const quote = quoteService.calculateDetailedQuote({
      width: 36,
      height: 48,
      type: 'standard',
      operationType: 'Hung',
      paneCount: 2,
      options: {
        lowE: false,
        grilles: false,
        glassType: 'clear'
      },
      quantity: 1
    });
    
    // Width 36 x Height 48 = 12 square feet (rounded up)
    expect(quote.window.dimensions.squareFootage).toBe(12);
    expect(quote.pricing.basePrice).toBe(464); // From pricing table for 12 sq ft Hung window
    expect(quote.pricing.windowSubtotal).toBe(464);
    expect(quote.pricing.installationCost).toBe(180); // 12 sq ft * $15 = $180
    expect(quote.pricing.total).toBe(644); // $464 + $180 = $644
  });
  
  // Test shaped window pricing
  test('should calculate shaped window price correctly', () => {
    const quote = quoteService.calculateDetailedQuote({
      width: 40,
      height: 50,
      type: 'shaped',
      operationType: 'Fixed',
      paneCount: 2,
      options: {
        lowE: false,
        grilles: false,
        glassType: 'clear'
      },
      quantity: 1
    });
    
    // Width 40 x Height 50 = 14 square feet (rounded up)
    const basePrice = 460 + (quoteService.PRICING_CONSTANTS.OVERAGE_PRICING.Fixed * 1);
    
    expect(quote.window.dimensions.squareFootage).toBe(14);
    expect(quote.pricing.basePrice).toBe(basePrice); // From pricing table + overage
    expect(quote.pricing.shapedWindowCost).toBe(800); // Medium tier shaped window top
    expect(quote.pricing.installationCost).toBeGreaterThan(200); // 14 sq ft * $15 * 1.15 factor > $200
    expect(quote.pricing.windowSubtotal).toBe(basePrice + 800); // Base + shaped top
  });
  
  // Test bay window pricing
  test('should calculate bay window price correctly', () => {
    const quote = quoteService.calculateDetailedQuote({
      width: 72,
      height: 60,
      type: 'bay',
      operationType: 'Casement',
      paneCount: 2,
      options: {
        lowE: false,
        grilles: false,
        glassType: 'clear'
      },
      quantity: 1,
      sidingArea: 10 // 10 sq ft of siding
    });
    
    // Width 72 x Height 60 = 30 square feet (rounded up)
    const baseFor13 = quoteService.PRICING_CONSTANTS.BASE_PRICING[13].Casement;
    const overage = 17; // 30 - 13
    const overagePrice = overage * quoteService.PRICING_CONSTANTS.OVERAGE_PRICING.Casement;
    const basePrice = baseFor13 + overagePrice;
    
    expect(quote.window.dimensions.squareFootage).toBe(30);
    expect(quote.pricing.basePrice).toBe(basePrice);
    expect(quote.pricing.bayWindowCost.headerFooter).toBe(basePrice * 0.5); // 50% of base price
    expect(quote.pricing.bayWindowCost.siding).toBe(150); // 10 sq ft * $15 = $150
    
    const expectedSubtotal = basePrice + (basePrice * 0.5) + 150;
    expect(quote.pricing.windowSubtotal).toBe(expectedSubtotal);
    
    const expectedInstallation = Math.round(Math.max(150, 30 * 15) * 1.15);
    expect(quote.pricing.installationCost).toBe(expectedInstallation);
  });
  
  // Test options pricing
  test('should calculate options pricing correctly', () => {
    const quote = quoteService.calculateDetailedQuote({
      width: 36,
      height: 48,
      type: 'standard',
      operationType: 'Hung',
      paneCount: 3, // Triple pane
      options: {
        lowE: true, // Low-E with argon
        grilles: true, // Grilles
        glassType: 'tinted' // Tinted glass
      },
      quantity: 1
    });
    
    const squareFootage = 12;
    
    expect(quote.pricing.optionsPrice.paneCount).toBe(squareFootage * quoteService.PRICING_CONSTANTS.PANE_OPTIONS.triple);
    expect(quote.pricing.optionsPrice.lowE).toBe(quoteService.PRICING_CONSTANTS.LOW_E_ARGON);
    expect(quote.pricing.optionsPrice.grilles).toBe(squareFootage * quoteService.PRICING_CONSTANTS.GRILLES);
    expect(quote.pricing.optionsPrice.glassType).toBe(squareFootage * quoteService.PRICING_CONSTANTS.GLASS_OPTIONS.tinted);
  });
  
  // Test quantity discount
  test('should apply quantity discount correctly', () => {
    const quote = quoteService.calculateDetailedQuote({
      width: 36,
      height: 48,
      type: 'standard',
      operationType: 'Hung',
      paneCount: 2,
      options: {},
      quantity: 5 // 5 windows should get 5% discount
    });
    
    const basePrice = 464; // For 12 sq ft Hung window
    const subtotal = basePrice * 5;
    const expectedDiscount = Math.round(subtotal * 0.05); // 5% discount
    
    expect(quote.pricing.subtotal).toBe(subtotal);
    expect(quote.pricing.discount).toBe(expectedDiscount);
    expect(quote.pricing.total).toBe(subtotal - expectedDiscount + quote.pricing.installationCost);
  });
  
  // Test legacy method for backward compatibility
  test('should provide backward compatibility', () => {
    const legacyResult = quoteService.calculateEstimate(36, 48, 'standard', 2, {});
    
    expect(legacyResult).toBeDefined();
    expect(legacyResult.squareFootage).toBe(12);
    expect(legacyResult.priceRange).toHaveProperty('min');
    expect(legacyResult.priceRange).toHaveProperty('max');
    expect(legacyResult.installationExtra).toBeDefined();
  });
  
  // Test error handling
  test('should handle invalid dimensions', () => {
    const result = quoteService.calculateDetailedQuote({
      width: 'invalid',
      height: 48,
      type: 'standard'
    });
    
    expect(result).toHaveProperty('error');
    expect(result.error).toBe('Unable to calculate quote');
  });
});