/**
 * Window Specification Validator
 * Validates window dimensions and provides user-friendly error messages
 */

const logger = require('./logger');

class WindowValidator {
  constructor() {
    // Universal dimension limits for all window types
    this.MIN_DIMENSION = 12; // 1 ft minimum
    this.MAX_DIMENSION = 120; // 10 ft maximum
  }
  
  /**
   * Validate dimensions with user-friendly messages
   * @param {number} width - Width in inches
   * @param {number} height - Height in inches
   * @returns {Object} - Validation result with isValid, errors, and suggestions
   */
  validateDimensions(width, height) {
    const errors = [];
    const suggestions = [];
    
    // Check if dimensions are provided
    if (width === null || width === undefined || height === null || height === undefined) {
      errors.push('Both width and height measurements are required to provide a quote');
      suggestions.push('Please provide window dimensions in inches (e.g., "36x48" or "36 inches by 48 inches")');
      return { isValid: false, errors, suggestions };
    }
    
    // Ensure dimensions are numbers
    if (typeof width !== 'number' || typeof height !== 'number') {
      errors.push('Width and height must be numeric values');
      suggestions.push('Please provide measurements as numbers (e.g., 36 for width, 48 for height)');
      return { isValid: false, errors, suggestions };
    }
    
    // Check width range
    if (width < this.MIN_DIMENSION) {
      errors.push(`Width must be at least ${this.MIN_DIMENSION} inches (1 foot)`);
      suggestions.push('Standard windows start at 12 inches wide. Did you mean a larger size?');
    } else if (width > this.MAX_DIMENSION) {
      errors.push(`Width cannot exceed ${this.MAX_DIMENSION} inches (10 feet)`);
      suggestions.push('For windows wider than 10 feet, please contact us for a custom quote');
    }
    
    // Check height range
    if (height < this.MIN_DIMENSION) {
      errors.push(`Height must be at least ${this.MIN_DIMENSION} inches (1 foot)`);
      suggestions.push('Standard windows start at 12 inches tall. Did you mean a larger size?');
    } else if (height > this.MAX_DIMENSION) {
      errors.push(`Height cannot exceed ${this.MAX_DIMENSION} inches (10 feet)`);
      suggestions.push('For windows taller than 10 feet, please contact us for a custom quote');
    }
    
    // Check aspect ratio for reasonable proportions
    const aspectRatio = width / height;
    if (aspectRatio < 0.25) {
      errors.push('This window appears unusually narrow for its height');
      suggestions.push(`Did you mean ${height}x${width} (width x height) instead?`);
    } else if (aspectRatio > 4) {
      errors.push('This window appears unusually wide for its height');
      suggestions.push(`Did you mean ${height}x${width} (width x height) instead?`);
    }
    
    // Check for common dimension swap errors (only suggest if there are no errors)
    if (errors.length === 0 && width > height * 2 && height < 36) {
      suggestions.push('Note: Width is typically listed first (width x height). Please verify your measurements.');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }
  
  /**
   * Validate unit conversion
   * @param {Object} dimensions - Dimensions object with width, height, and originalUnits
   * @returns {Object} - Validation result
   */
  validateUnitConversion(dimensions) {
    const errors = [];
    const suggestions = [];
    
    if (!dimensions) {
      return { isValid: true, errors, suggestions };
    }
    
    // Check if conversion was successful
    if (dimensions.originalUnits && dimensions.originalUnits !== 'inches') {
      // Verify conversion produced reasonable results
      if (dimensions.width < 1 || dimensions.height < 1) {
        errors.push('Unit conversion resulted in dimensions that are too small');
        suggestions.push('Please verify your measurements and units');
      }
      
      if (dimensions.width > 500 || dimensions.height > 500) {
        errors.push('Unit conversion resulted in dimensions that are too large');
        suggestions.push('Please verify your measurements and units');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }
  
  /**
   * Validate complete window specifications
   * @param {Object} specs - Window specifications to validate
   * @returns {Object} - Validation result with isValid, errors, suggestions, and warnings
   */
  validateWindowSpecifications(specs) {
    const allErrors = [];
    const allSuggestions = [];
    const warnings = [];
    
    // Validate dimensions
    const dimensionValidation = this.validateDimensions(specs.width, specs.height);
    if (!dimensionValidation.isValid) {
      allErrors.push(...dimensionValidation.errors);
    }
    // Always include suggestions, even if validation passes
    if (dimensionValidation.suggestions.length > 0) {
      allSuggestions.push(...dimensionValidation.suggestions);
    }
    
    // Validate unit conversion
    const unitValidation = this.validateUnitConversion({
      width: specs.width,
      height: specs.height,
      originalUnits: specs.originalUnits
    });
    if (!unitValidation.isValid) {
      allErrors.push(...unitValidation.errors);
      allSuggestions.push(...unitValidation.suggestions);
    }
    
    // Log validation failures for analysis
    if (allErrors.length > 0) {
      logger.warn('Window specification validation failed', {
        errors: allErrors,
        suggestions: allSuggestions,
        specs: {
          width: specs.width,
          height: specs.height,
          originalUnits: specs.originalUnits,
          operation_type: specs.operation_type,
          window_type: specs.window_type
        }
      });
    }
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      suggestions: allSuggestions,
      warnings
    };
  }
  
  /**
   * Format validation results for user display
   * @param {Object} validationResult - Result from validation
   * @returns {string} - Formatted message for user
   */
  formatValidationMessage(validationResult) {
    let message = '';
    
    if (validationResult.errors.length > 0) {
      message += '**Issues with your specifications:**\n';
      validationResult.errors.forEach(error => {
        message += `• ${error}\n`;
      });
      message += '\n';
    }
    
    if (validationResult.suggestions.length > 0) {
      message += '**Suggestions:**\n';
      validationResult.suggestions.forEach(suggestion => {
        message += `• ${suggestion}\n`;
      });
      message += '\n';
    }
    
    if (validationResult.warnings.length > 0) {
      message += '**Please note:**\n';
      validationResult.warnings.forEach(warning => {
        message += `• ${warning}\n`;
      });
    }
    
    return message.trim();
  }
  
  /**
   * Get dimension requirements for user guidance
   * @returns {string} - User-friendly dimension requirements
   */
  getDimensionRequirements() {
    return `Window dimensions must be between ${this.MIN_DIMENSION}" and ${this.MAX_DIMENSION}" (1 to 10 feet) for both width and height.`;
  }
}

module.exports = new WindowValidator();