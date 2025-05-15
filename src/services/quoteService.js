const logger = require('../utils/logger');

/**
 * Service for calculating window quotes with enhanced pricing variables
 */
class QuoteService {
  constructor() {
    // Define pricing constants
    this.PRICING_CONSTANTS = {
      // Base pricing table by square footage and operation type
      BASE_PRICING: {
        6: { Awning: 379, Casement: 379, Fixed: 326, Slider: 334, Hung: 340 },
        7: { Awning: 393, Casement: 393, Fixed: 345, Slider: 355, Hung: 361 },
        8: { Awning: 409, Casement: 409, Fixed: 364, Slider: 377, Hung: 381 },
        9: { Awning: 446, Casement: 446, Fixed: 383, Slider: 396, Hung: 402 },
        10: { Awning: 469, Casement: 469, Fixed: 402, Slider: 417, Hung: 422 },
        11: { Awning: 496, Casement: 496, Fixed: 421, Slider: 438, Hung: 443 },
        12: { Awning: 508, Casement: 508, Fixed: 442, Slider: 457, Hung: 464 },
        13: { Awning: 520, Casement: 520, Fixed: 460, Slider: 476, Hung: 484 }
      },
      
      // Overage pricing for square footage beyond 13
      OVERAGE_PRICING: {
        Awning: 37,
        Casement: 37,
        Fixed: 34,
        Slider: 34,
        Hung: 36
      },
      
      // Shaped window top section pricing by diameter
      SHAPED_WINDOW_PRICING: {
        small: 600,      // Up to 35 inches diameter
        medium: 800,     // 36-50 inches diameter
        large: 1000,     // 51-75 inches diameter
        extraLarge: 1400 // 76+ inches diameter
      },
      
      // Glass option pricing
      GLASS_OPTIONS: {
        clear: 0,
        frosted: 4,  // per square foot
        tinted: 5    // per square foot
      },
      
      // Pane count pricing
      PANE_OPTIONS: {
        double: 0,
        triple: 11   // per square foot
      },
      
      // Feature pricing
      LOW_E_ARGON: 110,  // per window
      GRILLES: 5,        // per square foot
      
      // Installation pricing
      INSTALLATION: {
        pricePerSquareFoot: 15,
        minimumPrice: 150,
        categoryFactors: {
          standard: 1.0,
          bay: 1.15,
          shaped: 1.15
        }
      },
      
      // Bay window pricing
      BAY_WINDOW: {
        headerFooterFactor: 0.5,  // 50% of standard window price
        sidingCostPerSqFt: 15     // For vinyl or aluminum
      },
      
      // Quantity discount thresholds
      QUANTITY_DISCOUNTS: {
        2: 0.02,  // 2% discount for 2 windows
        3: 0.03,  // 3% discount for 3 windows
        5: 0.05,  // 5% discount for 5+ windows
        10: 0.08, // 8% discount for 10+ windows
        20: 0.12  // 12% discount for 20+ windows
      },
      
      // Tax rate (if needed)
      TAX_RATE: 0.13
    };
  }
  
  /**
   * Calculate window price based on operation type and square footage
   * @param {string} operationType - Type of window operation
   * @param {number} squareFootage - Square footage of window
   * @returns {number} - Base window price
   */
  calculateBasePrice(operationType, squareFootage) {
    // Default to Hung if operation type not specified
    operationType = operationType || 'Hung';
    
    // Handle square footage outside the base pricing table range
    if (squareFootage < 6) {
      squareFootage = 6; // Minimum size
    }
    
    let basePrice;
    
    // If square footage is in the base pricing table
    if (squareFootage <= 13) {
      basePrice = this.PRICING_CONSTANTS.BASE_PRICING[squareFootage][operationType];
    } else {
      // For windows larger than 13 sq ft, calculate overage
      const baseFor13 = this.PRICING_CONSTANTS.BASE_PRICING[13][operationType];
      const overage = squareFootage - 13;
      const overagePrice = overage * this.PRICING_CONSTANTS.OVERAGE_PRICING[operationType];
      basePrice = baseFor13 + overagePrice;
    }
    
    return basePrice;
  }
  
  /**
   * Get price for arched top section of shaped windows
   * @param {number} width - Width of window (diameter of arched section)
   * @returns {number} - Price for arched top
   */
  getShapedWindowTopPrice(width) {
    if (width <= 35) {
      return this.PRICING_CONSTANTS.SHAPED_WINDOW_PRICING.small;
    } else if (width <= 50) {
      return this.PRICING_CONSTANTS.SHAPED_WINDOW_PRICING.medium;
    } else if (width <= 75) {
      return this.PRICING_CONSTANTS.SHAPED_WINDOW_PRICING.large;
    } else {
      return this.PRICING_CONSTANTS.SHAPED_WINDOW_PRICING.extraLarge;
    }
  }
  
  /**
   * Calculate installation cost
   * @param {number} squareFootage - Square footage of window
   * @param {string} windowType - Type of window
   * @returns {number} - Installation cost
   */
  calculateInstallation(squareFootage, windowType) {
    const baseInstallation = Math.max(
      this.PRICING_CONSTANTS.INSTALLATION.minimumPrice,
      squareFootage * this.PRICING_CONSTANTS.INSTALLATION.pricePerSquareFoot
    );
    
    // Apply category factor if applicable
    const categoryFactor = this.PRICING_CONSTANTS.INSTALLATION.categoryFactors[windowType.toLowerCase()] || 1;
    
    return Math.round(baseInstallation * categoryFactor);
  }
  
  /**
   * Calculate quantity discount based on number of windows
   * @param {number} quantity - Number of windows
   * @param {number} subtotal - Subtotal price before discount
   * @returns {number} - Discount amount
   */
  calculateQuantityDiscount(quantity, subtotal) {
    let discountRate = 0;
    
    // Find the applicable discount rate
    for (const [threshold, rate] of Object.entries(this.PRICING_CONSTANTS.QUANTITY_DISCOUNTS)
                                         .sort((a, b) => b[0] - a[0])) {
      if (quantity >= parseInt(threshold)) {
        discountRate = rate;
        break;
      }
    }
    
    return Math.round(subtotal * discountRate);
  }
  
  /**
   * Calculate bay window header and footer cost
   * @param {number} standardPrice - Price of standard window portion
   * @returns {number} - Header and footer cost
   */
  calculateBayHeaderFooter(standardPrice) {
    return standardPrice * this.PRICING_CONSTANTS.BAY_WINDOW.headerFooterFactor;
  }
  
  /**
   * Calculate bay window siding cost
   * @param {number} sidingArea - Square footage of siding area
   * @returns {number} - Siding cost
   */
  calculateBaySiding(sidingArea) {
    return sidingArea * this.PRICING_CONSTANTS.BAY_WINDOW.sidingCostPerSqFt;
  }
  
  /**
   * Enhanced method to calculate window quote
   * @param {Object} specs - Window specifications
   * @param {number} specs.width - Width in inches
   * @param {number} specs.height - Height in inches
   * @param {string} specs.type - Window type (standard, bay, shaped)
   * @param {string} specs.operationType - Window operation type (Hung, Slider, etc)
   * @param {number} specs.paneCount - Number of panes (1, 2, or 3)
   * @param {Object} specs.options - Additional options
   * @param {boolean} specs.options.lowE - Has low-E glass
   * @param {boolean} specs.options.grilles - Has grilles
   * @param {string} specs.options.glassType - Type of glass (clear, frosted, tinted)
   * @param {number} specs.quantity - Number of windows (for discount)
   * @param {number} specs.sidingArea - Square footage of siding (for bay windows)
   * @returns {Object} - Detailed quote breakdown
   */
  calculateDetailedQuote(specs) {
    try {
      // Extract and validate parameters
      const width = parseFloat(specs.width);
      const height = parseFloat(specs.height);
      const type = (specs.type || 'standard').toLowerCase();
      const operationType = specs.operationType || 'Hung';
      const paneCount = specs.paneCount || 2;
      const options = specs.options || {};
      const quantity = specs.quantity || 1;
      const sidingArea = specs.sidingArea || 0;
      
      if (isNaN(width) || isNaN(height)) {
        throw new Error('Invalid dimensions');
      }
      
      // Calculate square footage (rounded up)
      const squareFootage = Math.ceil((width * height) / 144);
      
      // Initialize pricing components
      let basePrice = 0;
      let optionsPrice = {
        glassType: 0,
        paneCount: 0,
        lowE: 0,
        grilles: 0
      };
      let shapedWindowCost = 0;
      let bayWindowCost = {
        headerFooter: 0,
        siding: 0
      };
      
      // Calculate base price based on window type
      if (type === 'standard') {
        basePrice = this.calculateBasePrice(operationType, squareFootage);
      } else if (type === 'shaped') {
        // For shaped windows, calculate rectangular bottom section
        basePrice = this.calculateBasePrice(operationType, squareFootage);
        
        // Add cost for arched top section based on width (diameter)
        shapedWindowCost = this.getShapedWindowTopPrice(width);
      } else if (type === 'bay') {
        // For bay windows, calculate standard window price
        basePrice = this.calculateBasePrice(operationType, squareFootage);
        
        // Add header and footer cost
        bayWindowCost.headerFooter = this.calculateBayHeaderFooter(basePrice);
        
        // Add siding cost if applicable
        if (sidingArea > 0) {
          bayWindowCost.siding = this.calculateBaySiding(sidingArea);
        }
      }
      
      // Calculate options pricing
      
      // Glass type
      const glassType = options.glassType || 'clear';
      if (glassType !== 'clear') {
        optionsPrice.glassType = squareFootage * this.PRICING_CONSTANTS.GLASS_OPTIONS[glassType] || 0;
      }
      
      // Pane count (triple pane is an upgrade)
      if (paneCount === 3) {
        optionsPrice.paneCount = squareFootage * this.PRICING_CONSTANTS.PANE_OPTIONS.triple;
      }
      
      // Low-E with argon
      if (options.lowE) {
        optionsPrice.lowE = this.PRICING_CONSTANTS.LOW_E_ARGON;
      }
      
      // Grilles
      if (options.grilles) {
        optionsPrice.grilles = squareFootage * this.PRICING_CONSTANTS.GRILLES;
      }
      
      // Calculate subtotal for single window
      const optionsSubtotal = Object.values(optionsPrice).reduce((sum, price) => sum + price, 0);
      const windowSubtotal = basePrice + optionsSubtotal + shapedWindowCost + 
                            bayWindowCost.headerFooter + bayWindowCost.siding;
      
      // Calculate installation
      const installationCost = this.calculateInstallation(squareFootage, type);
      
      // Calculate total for all windows
      const subtotal = windowSubtotal * quantity;
      
      // Apply quantity discount if applicable
      const discount = this.calculateQuantityDiscount(quantity, subtotal);
      
      // Final total
      const total = subtotal - discount + installationCost;
      
      // Create detailed quote object
      const quote = {
        window: {
          dimensions: {
            width,
            height,
            squareFootage
          },
          type,
          operationType,
          paneCount,
          options: {
            lowE: !!options.lowE,
            grilles: !!options.grilles,
            glassType
          },
          quantity
        },
        pricing: {
          basePrice,
          optionsPrice,
          bayWindowCost: type === 'bay' ? bayWindowCost : undefined,
          shapedWindowCost: type === 'shaped' ? shapedWindowCost : undefined,
          windowSubtotal,
          subtotal,
          discount,
          installationCost,
          total
        },
        quoteLink: `/api/quotes/details?window=${encodeURIComponent(JSON.stringify({
          width, height, type, operationType, paneCount, options, quantity, sidingArea
        }))}` // URL for detailed quote that will be handled by quoteDetailService
      };
      
      logger.debug('Generated window quote', { specs, quote });
      
      return quote;
    } catch (error) {
      logger.error('Error calculating quote:', error);
      return {
        error: 'Unable to calculate quote',
        message: error.message
      };
    }
  }
  
  /**
   * Legacy method for backward compatibility
   * @param {number} width - Width in inches
   * @param {number} height - Height in inches
   * @param {string} type - Window type
   * @param {number} paneCount - Number of panes
   * @param {Object} options - Additional options
   * @returns {Object} - Simple quote result
   */
  calculateEstimate(width, height, type = 'standard', paneCount = 2, options = {}) {
    // Call the detailed method with simplified parameters
    const result = this.calculateDetailedQuote({
      width,
      height,
      type,
      operationType: 'Hung', // Default for backward compatibility
      paneCount,
      options,
      quantity: 1
    });
    
    // Handle error case
    if (result.error) {
      return null;
    }
    
    // Convert to legacy format
    const legacyResult = {
      squareFootage: result.window.dimensions.squareFootage,
      priceRange: {
        min: Math.round(result.pricing.total * 0.9),
        max: Math.round(result.pricing.total * 1.1)
      },
      installationExtra: result.pricing.installationCost
    };
    
    return legacyResult;
  }
}

module.exports = new QuoteService();