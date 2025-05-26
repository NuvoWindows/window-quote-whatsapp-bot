/**
 * QuestionGenerator
 * 
 * Generates contextual questions based on missing fields from SpecificationValidator.
 * Considers already-known information to create better, more targeted questions.
 * Prioritizes questions by field importance and provides helpful context.
 */

const logger = require('./logger');

class QuestionGenerator {
  constructor() {
    // Define question templates for each field
    this.questionTemplates = {
      width: {
        simple: "What is the width of your window in inches?",
        withContext: "I need the width of your window. Please measure from the inside frame edge to edge in inches.",
        withHeight: (height) => `You mentioned your window is ${height} inches tall. What is the width in inches?`,
        withExample: "What is the width of your window? For example, a typical bedroom window might be 36 inches wide."
      },
      
      height: {
        simple: "What is the height of your window in inches?",
        withContext: "I need the height of your window. Please measure from the inside frame, top to bottom in inches.",
        withWidth: (width) => `You mentioned your window is ${width} inches wide. What is the height in inches?`,
        withExample: "What is the height of your window? For example, a typical window might be 48 inches tall."
      },
      
      operation_type: {
        simple: "How does your window open?",
        detailed: "How does your window operate? For example:\n• Fixed (doesn't open)\n• Hung (slides up and down)\n• Slider (slides left and right)\n• Casement (cranks outward)\n• Awning (hinges at top, opens outward)",
        withDimensions: (width, height) => `For a ${width}x${height} inch window, how does it open? Is it fixed, hung, slider, casement, or awning?`
      },
      
      glass_type: {
        simple: "What type of glass would you like?",
        detailed: "What type of glass do you prefer?\n• Clear glass (standard)\n• Tinted glass (reduces glare)\n• Low-E glass (energy efficient)\n• Tempered glass (safety glass)",
        withPanes: (paneCount) => `For ${paneCount}-pane glass, what type would you like - clear, tinted, Low-E, or tempered?`
      },
      
      pane_count: {
        simple: "Would you like single, double, or triple pane glass?",
        detailed: "How many panes of glass would you like?\n• Single pane (basic, less insulation)\n• Double pane (standard, good insulation)\n• Triple pane (premium, best insulation)",
        withEfficiency: "For energy efficiency, would you prefer double pane or triple pane glass?"
      },
      
      has_low_e: {
        simple: "Would you like Low-E coating for energy efficiency?",
        detailed: "Low-E coating improves energy efficiency by reflecting heat. Would you like Low-E coating on your glass?",
        withPanes: (paneCount) => `For your ${paneCount}-pane window, would you like Low-E coating for better energy efficiency?`
      },
      
      has_argon: {
        simple: "Would you like argon gas fill for better insulation?",
        detailed: "Argon gas between glass panes provides better insulation than regular air. Would you like argon fill?",
        withLowE: (hasLowE) => hasLowE ? 
          "Since you want Low-E coating, would you also like argon gas fill for maximum efficiency?" :
          "Would you like argon gas fill between the glass panes for better insulation?"
      },
      
      frame_material: {
        simple: "What frame material would you prefer?",
        detailed: "What frame material would you like?\n• Vinyl (maintenance-free, affordable)\n• Wood (traditional, paintable)\n• Aluminum (durable, slim profile)\n• Fiberglass (premium, very durable)",
        withBudget: "What frame material fits your needs - vinyl (economical), wood (traditional), aluminum (durable), or fiberglass (premium)?"
      },
      
      grid_type: {
        simple: "Would you like any decorative grids on your window?",
        detailed: "What style of window grids would you like?\n• None (clean, modern look)\n• Colonial (traditional rectangles)\n• Prairie (geometric pattern)\n• Diamond (diagonal pattern)",
        optional: "For the finishing touch, would you like decorative grids? This is optional - you can choose none for a clean look."
      }
    };
    
    // Define follow-up questions for validation errors
    this.correctionQuestions = {
      width: {
        tooLarge: "That width seems quite large. Could you double-check the measurement? Windows are typically under 120 inches wide.",
        invalid: "I need the width as a number in inches. For example, '36' for a 36-inch wide window."
      },
      
      height: {
        tooLarge: "That height seems quite large. Could you double-check the measurement? Windows are typically under 120 inches tall.",
        invalid: "I need the height as a number in inches. For example, '48' for a 48-inch tall window."
      },
      
      operation_type: {
        invalid: "I didn't recognize that window type. Please choose from: fixed, hung, slider, casement, or awning."
      },
      
      glass_type: {
        invalid: "Please choose from these glass types: clear, tinted, Low-E, or tempered."
      },
      
      pane_count: {
        invalid: "Please specify single pane (1), double pane (2), or triple pane (3)."
      }
    };
  }
  
  /**
   * Generate a question for a missing or invalid field
   * @param {Object} field - Field object from SpecificationValidator
   * @param {Object} currentSpecs - Current window specifications
   * @param {string} action - 'collect' for missing fields, 'correct' for invalid fields
   * @returns {string} - Generated question
   */
  generateQuestion(field, currentSpecs, action = 'collect') {
    try {
      if (action === 'correct') {
        return this.generateCorrectionQuestion(field, currentSpecs);
      }
      
      return this.generateCollectionQuestion(field, currentSpecs);
    } catch (error) {
      logger.logError(error, {
        operation: 'GENERATE_QUESTION',
        field: field.field,
        action
      });
      
      // Fallback to simple question
      return this.questionTemplates[field.field]?.simple || 
             `Could you please provide the ${field.label.toLowerCase()}?`;
    }
  }
  
  /**
   * Generate a question to collect a missing field
   * @param {Object} field - Field object from SpecificationValidator
   * @param {Object} currentSpecs - Current window specifications
   * @returns {string} - Generated question
   */
  generateCollectionQuestion(field, currentSpecs) {
    const templates = this.questionTemplates[field.field];
    
    if (!templates) {
      return `Could you please provide the ${field.label.toLowerCase()}?`;
    }
    
    // Use context-aware questions when possible
    switch (field.field) {
      case 'width':
        if (currentSpecs.height) {
          return templates.withHeight(currentSpecs.height);
        }
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.withContext : templates.withExample;
      
      case 'height':
        if (currentSpecs.width) {
          return templates.withWidth(currentSpecs.width);
        }
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.withContext : templates.withExample;
      
      case 'operation_type':
        if (currentSpecs.width && currentSpecs.height) {
          return templates.withDimensions(currentSpecs.width, currentSpecs.height);
        }
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.simple;
      
      case 'glass_type':
        if (currentSpecs.pane_count) {
          return templates.withPanes(this.getPaneDescription(currentSpecs.pane_count));
        }
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.simple;
      
      case 'pane_count':
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.withEfficiency;
      
      case 'has_low_e':
        if (currentSpecs.pane_count) {
          return templates.withPanes(this.getPaneDescription(currentSpecs.pane_count));
        }
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.simple;
      
      case 'has_argon':
        if (currentSpecs.has_low_e !== undefined) {
          return templates.withLowE(currentSpecs.has_low_e);
        }
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.simple;
      
      case 'frame_material':
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.withBudget;
      
      case 'grid_type':
        return this.shouldUseDetailedQuestion(currentSpecs) ? 
               templates.detailed : templates.optional;
      
      default:
        return templates.simple;
    }
  }
  
  /**
   * Generate a question to correct an invalid field
   * @param {Object} field - Field object from SpecificationValidator
   * @param {Object} currentSpecs - Current window specifications
   * @returns {string} - Generated correction question
   */
  generateCorrectionQuestion(field, currentSpecs) {
    const corrections = this.correctionQuestions[field.field];
    
    if (!corrections) {
      return `The ${field.label.toLowerCase()} you provided isn't valid. Could you please provide it again?`;
    }
    
    // Check for specific validation issues
    switch (field.field) {
      case 'width':
      case 'height':
        const value = parseFloat(field.value);
        if (value > 120) {
          return corrections.tooLarge;
        }
        return corrections.invalid;
      
      default:
        return corrections.invalid;
    }
  }
  
  /**
   * Determine if we should use detailed questions based on user interaction
   * @param {Object} currentSpecs - Current window specifications
   * @returns {boolean} - Whether to use detailed questions
   */
  shouldUseDetailedQuestion(currentSpecs) {
    // Use detailed questions if user seems to need guidance
    // (This is a simple heuristic - could be enhanced with user knowledge assessment)
    
    // If user has provided very little information, they might need more guidance
    const providedFields = Object.keys(currentSpecs).length;
    
    // If they've provided basic info, they probably understand the process
    if (providedFields >= 3) {
      return false;
    }
    
    // New users get more detailed questions
    return true;
  }
  
  /**
   * Get a description for the number of panes
   * @param {number} paneCount - Number of panes
   * @returns {string} - Description of pane count
   */
  getPaneDescription(paneCount) {
    switch (paneCount) {
      case 1: return 'single';
      case 2: return 'double';
      case 3: return 'triple';
      default: return `${paneCount}`;
    }
  }
  
  /**
   * Generate a summary question when multiple fields are missing
   * @param {Array} missingFields - Array of missing field objects
   * @param {Object} currentSpecs - Current window specifications
   * @returns {string} - Generated summary question
   */
  generateSummaryQuestion(missingFields, currentSpecs) {
    if (missingFields.length === 0) {
      return "Great! I have all the information I need.";
    }
    
    if (missingFields.length === 1) {
      return this.generateQuestion(missingFields[0], currentSpecs, 'collect');
    }
    
    // For multiple missing fields, focus on the most important
    const criticalFields = missingFields.filter(field => field.priority === 1);
    
    if (criticalFields.length > 0) {
      if (criticalFields.length === 1) {
        return this.generateQuestion(criticalFields[0], currentSpecs, 'collect');
      }
      
      // Multiple critical fields - ask for them together if they're dimensions
      const dimensionFields = criticalFields.filter(field => 
        ['width', 'height'].includes(field.field)
      );
      
      if (dimensionFields.length === 2) {
        return "I need the dimensions of your window. What are the width and height in inches? For example: '36 inches wide by 48 inches tall'.";
      }
      
      // Otherwise, ask for the first critical field
      return this.generateQuestion(criticalFields[0], currentSpecs, 'collect');
    }
    
    // Only non-critical fields missing
    return this.generateQuestion(missingFields[0], currentSpecs, 'collect');
  }
  
  /**
   * Generate an encouraging message about progress
   * @param {number} completionPercentage - Completion percentage from validator
   * @param {Array} missingFields - Remaining missing fields
   * @returns {string} - Encouraging progress message
   */
  generateProgressMessage(completionPercentage, missingFields) {
    if (completionPercentage >= 90) {
      return "We're almost done! Just a couple more details.";
    }
    
    if (completionPercentage >= 70) {
      return "Great progress! We're getting close.";
    }
    
    if (completionPercentage >= 50) {
      return "Good! We're about halfway through gathering your window details.";
    }
    
    if (completionPercentage >= 25) {
      return "Thanks for those details! Let's continue.";
    }
    
    return "Let's gather some information about your window.";
  }
}

module.exports = QuestionGenerator;