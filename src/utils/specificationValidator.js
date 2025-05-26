/**
 * SpecificationValidator
 * 
 * Validates window specifications and identifies missing required fields
 * for quote generation. Prioritizes fields by importance and determines
 * if specifications are complete enough for quote generation.
 */

const logger = require('./logger');

class SpecificationValidator {
  constructor() {
    // Define required fields and their priorities
    this.requiredFields = {
      // Critical fields - must have for any quote
      width: { priority: 1, type: 'number', label: 'Width' },
      height: { priority: 1, type: 'number', label: 'Height' },
      operation_type: { priority: 1, type: 'string', label: 'Operation Type' },
      
      // Important fields - needed for accurate quote
      glass_type: { priority: 2, type: 'string', label: 'Glass Type' },
      pane_count: { priority: 2, type: 'number', label: 'Pane Count' },
      
      // Energy efficiency fields - can have defaults
      has_low_e: { priority: 3, type: 'boolean', label: 'Low-E Coating' },
      has_argon: { priority: 3, type: 'boolean', label: 'Argon Fill' },
      
      // Optional fields with defaults
      frame_material: { priority: 4, type: 'string', label: 'Frame Material', default: 'vinyl' },
      grid_type: { priority: 4, type: 'string', label: 'Grid Type', default: 'none' }
    };
    
    // Define validation rules
    this.validationRules = {
      width: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 && num <= 120; // Max 120 inches wide
      },
      height: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 && num <= 120; // Max 120 inches tall
      },
      operation_type: (value) => {
        const validTypes = ['fixed', 'hung', 'slider', 'casement', 'awning', 'hopper'];
        return validTypes.includes(value?.toLowerCase());
      },
      glass_type: (value) => {
        const validTypes = ['clear', 'tinted', 'low_e', 'tempered'];
        return validTypes.includes(value?.toLowerCase());
      },
      pane_count: (value) => {
        const num = parseInt(value);
        return [1, 2, 3].includes(num);
      },
      has_low_e: (value) => {
        return typeof value === 'boolean';
      },
      has_argon: (value) => {
        return typeof value === 'boolean';
      },
      frame_material: (value) => {
        const validMaterials = ['vinyl', 'wood', 'aluminum', 'fiberglass'];
        return validMaterials.includes(value?.toLowerCase());
      },
      grid_type: (value) => {
        const validTypes = ['none', 'colonial', 'prairie', 'diamond'];
        return validTypes.includes(value?.toLowerCase());
      }
    };
  }
  
  /**
   * Validate specifications and identify missing or invalid fields
   * @param {Object} specs - Window specifications to validate
   * @returns {Object} - Validation results
   */
  validateSpecifications(specs) {
    const missing = [];
    const invalid = [];
    const warnings = [];
    const complete = [];
    
    // Check each required field
    for (const [fieldName, fieldConfig] of Object.entries(this.requiredFields)) {
      const value = specs[fieldName];
      
      // Check if field is missing
      if (value === undefined || value === null || value === '') {
        missing.push({
          field: fieldName,
          label: fieldConfig.label,
          priority: fieldConfig.priority,
          type: fieldConfig.type,
          default: fieldConfig.default
        });
      }
      // Check if field is invalid
      else if (this.validationRules[fieldName] && !this.validationRules[fieldName](value)) {
        invalid.push({
          field: fieldName,
          label: fieldConfig.label,
          value: value,
          priority: fieldConfig.priority
        });
      }
      // Field is valid
      else {
        complete.push({
          field: fieldName,
          label: fieldConfig.label,
          value: value,
          priority: fieldConfig.priority
        });
      }
    }
    
    // Check for logical inconsistencies
    const logicalWarnings = this.checkLogicalConsistency(specs);
    warnings.push(...logicalWarnings);
    
    // Sort by priority (lower number = higher priority)
    missing.sort((a, b) => a.priority - b.priority);
    invalid.sort((a, b) => a.priority - b.priority);
    
    // Determine if we have enough for a quote
    const canGenerateQuote = this.canGenerateQuote(missing, invalid);
    
    return {
      isValid: missing.length === 0 && invalid.length === 0,
      canGenerateQuote,
      missing,
      invalid,
      warnings,
      complete,
      completionPercentage: this.calculateCompletionPercentage(complete, missing, invalid)
    };
  }
  
  /**
   * Check for logical inconsistencies in specifications
   * @param {Object} specs - Window specifications
   * @returns {Array} - Array of warning objects
   */
  checkLogicalConsistency(specs) {
    const warnings = [];
    
    // Check if Low-E and argon make sense with pane count
    if (specs.pane_count === 1 && (specs.has_low_e || specs.has_argon)) {
      warnings.push({
        type: 'logical_inconsistency',
        message: 'Single pane windows typically do not have Low-E coating or argon fill',
        severity: 'warning'
      });
    }
    
    // Check if dimensions are unusual
    if (specs.width && specs.height) {
      const width = parseFloat(specs.width);
      const height = parseFloat(specs.height);
      
      if (width > height * 3) {
        warnings.push({
          type: 'unusual_dimensions',
          message: 'Window is unusually wide relative to height',
          severity: 'info'
        });
      }
      
      if (height > width * 3) {
        warnings.push({
          type: 'unusual_dimensions',
          message: 'Window is unusually tall relative to width',
          severity: 'info'
        });
      }
    }
    
    // Check if operation type makes sense with dimensions
    if (specs.operation_type === 'slider' && specs.height && parseFloat(specs.height) > 60) {
      warnings.push({
        type: 'operation_dimension_mismatch',
        message: 'Slider windows are typically not recommended for heights over 60 inches',
        severity: 'warning'
      });
    }
    
    return warnings;
  }
  
  /**
   * Determine if we have enough information to generate a quote
   * @param {Array} missing - Missing fields
   * @param {Array} invalid - Invalid fields
   * @returns {boolean} - Whether a quote can be generated
   */
  canGenerateQuote(missing, invalid) {
    // Cannot generate quote if any invalid fields
    if (invalid.length > 0) {
      return false;
    }
    
    // Cannot generate quote if missing critical fields (priority 1)
    const missingCritical = missing.filter(field => field.priority === 1);
    if (missingCritical.length > 0) {
      return false;
    }
    
    // Can generate quote if we have all critical fields
    // Missing priority 2+ fields can use defaults
    return true;
  }
  
  /**
   * Calculate completion percentage of specifications
   * @param {Array} complete - Complete fields
   * @param {Array} missing - Missing fields
   * @param {Array} invalid - Invalid fields
   * @returns {number} - Completion percentage (0-100)
   */
  calculateCompletionPercentage(complete, missing, invalid) {
    const totalFields = Object.keys(this.requiredFields).length;
    const completedFields = complete.length;
    
    return Math.round((completedFields / totalFields) * 100);
  }
  
  /**
   * Get the next most important missing field
   * @param {Object} validationResult - Result from validateSpecifications
   * @returns {Object|null} - Next field to collect or null if complete
   */
  getNextMissingField(validationResult) {
    // First check for invalid fields that need correction
    if (validationResult.invalid.length > 0) {
      return {
        ...validationResult.invalid[0],
        action: 'correct'
      };
    }
    
    // Then check for missing fields by priority
    if (validationResult.missing.length > 0) {
      return {
        ...validationResult.missing[0],
        action: 'collect'
      };
    }
    
    return null;
  }
  
  /**
   * Apply default values for missing non-critical fields
   * @param {Object} specs - Current specifications
   * @returns {Object} - Specifications with defaults applied
   */
  applyDefaults(specs) {
    const specsWithDefaults = { ...specs };
    
    // Apply defaults for missing fields that have them
    for (const [fieldName, fieldConfig] of Object.entries(this.requiredFields)) {
      if (fieldConfig.default && (specs[fieldName] === undefined || specs[fieldName] === null)) {
        specsWithDefaults[fieldName] = fieldConfig.default;
        
        logger.info('Applied default value for missing field', {
          field: fieldName,
          defaultValue: fieldConfig.default
        });
      }
    }
    
    // Apply energy efficiency defaults if glass type is specified but efficiency options are not
    if (specsWithDefaults.pane_count >= 2) {
      if (specsWithDefaults.has_low_e === undefined) {
        specsWithDefaults.has_low_e = true; // Default to Low-E for multi-pane
      }
      if (specsWithDefaults.has_argon === undefined) {
        specsWithDefaults.has_argon = true; // Default to argon for multi-pane
      }
    } else {
      // Single pane defaults
      if (specsWithDefaults.has_low_e === undefined) {
        specsWithDefaults.has_low_e = false;
      }
      if (specsWithDefaults.has_argon === undefined) {
        specsWithDefaults.has_argon = false;
      }
    }
    
    return specsWithDefaults;
  }
  
  /**
   * Get a human-readable summary of validation results
   * @param {Object} validationResult - Result from validateSpecifications
   * @returns {string} - Human-readable summary
   */
  getValidationSummary(validationResult) {
    if (validationResult.isValid) {
      return "All specifications are complete and valid.";
    }
    
    const parts = [];
    
    if (validationResult.invalid.length > 0) {
      parts.push(`${validationResult.invalid.length} field(s) need correction`);
    }
    
    if (validationResult.missing.length > 0) {
      parts.push(`${validationResult.missing.length} field(s) are missing`);
    }
    
    if (validationResult.canGenerateQuote) {
      parts.push("Quote can be generated with defaults");
    } else {
      parts.push("More information needed for quote");
    }
    
    return parts.join(', ') + `.`;
  }
}

module.exports = SpecificationValidator;