class QuoteService {
    calculateEstimate(width, height, type = 'standard', paneCount = 2, options = {}) {
      try {
        // Convert dimensions to numbers
        width = parseFloat(width);
        height = parseFloat(height);
        
        if (isNaN(width) || isNaN(height)) {
          throw new Error('Invalid dimensions');
        }
        
        // Calculate square footage (rounded up)
        const squareFootage = Math.ceil((width * height) / 144);
        
        // Base price per square foot
        let pricePerSqFt = 40;
        
        // Adjust for window type
        if (type.toLowerCase() === 'bay') {
          pricePerSqFt *= 1.25; // 25% more for bay windows
        } else if (type.toLowerCase() === 'shaped') {
          pricePerSqFt *= 1.15; // 15% more for shaped windows
        }
        
        // Calculate base price
        let totalPrice = squareFootage * pricePerSqFt;
        
        // Add for triple pane
        if (paneCount === 3) {
          totalPrice += squareFootage * 11;
        }
        
        // Add for low-E glass with argon
        if (options.lowE) {
          totalPrice += 125;
        }
        
        // Add for grilles
        if (options.grilles) {
          totalPrice += squareFootage * 5;
        }
        
        // Create price range (±10%)
        const minPrice = Math.round(totalPrice * 0.9);
        const maxPrice = Math.round(totalPrice * 1.1);
        
        return {
          squareFootage,
          priceRange: {
            min: minPrice,
            max: maxPrice
          },
          installationExtra: Math.max(150, squareFootage * 15) // Installation estimate
        };
      } catch (error) {
        console.error('Error calculating quote:', error);
        return null;
      }
    }
  }
  
  module.exports = new QuoteService();