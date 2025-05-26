/**
 * AmbiguityDetector
 * 
 * Detects ambiguous terms in user input and provides suggestions for clarification.
 * Focuses on common ambiguous terms like "standard", "regular", "normal" that 
 * users often use but need specific clarification for accurate quotes.
 */

const logger = require('./logger');

class AmbiguityDetector {
  constructor() {
    // Define mappings of ambiguous terms to clarification options
    this.ambiguousTerms = {
      size: {
        'small': { 
          suggestion: '24x36', 
          clarify: 'By small, do you mean around 24x36 inches?',
          confidence: 0.7
        },
        'medium': { 
          suggestion: '36x48', 
          clarify: 'Medium typically means 36x48 inches. Is that about right?',
          confidence: 0.8
        },
        'large': { 
          suggestion: '48x60', 
          clarify: 'For large windows, do you mean around 48x60 inches?',
          confidence: 0.7
        },
        'standard': { 
          suggestion: '36x48', 
          clarify: 'Standard windows are often 36x48 inches. Is that correct?',
          confidence: 0.6
        },
        'regular': { 
          suggestion: '36x48', 
          clarify: 'By regular size, do you mean around 36x48 inches?',
          confidence: 0.5
        },
        'normal': { 
          suggestion: '36x48', 
          clarify: 'For a normal sized window, would 36x48 inches be about right?',
          confidence: 0.5
        },
        'typical': { 
          suggestion: '36x48', 
          clarify: 'A typical window is often 36x48 inches. Does that sound right?',
          confidence: 0.6
        }
      },
      
      type: {
        'regular': { 
          options: ['Fixed', 'Casement'], 
          clarify: 'By regular window, do you mean fixed (non-opening) or casement (crank-out)?',
          confidence: 0.6
        },
        'normal': { 
          options: ['Fixed', 'Casement'], 
          clarify: 'For a normal window, would you prefer fixed or casement?',
          confidence: 0.5
        },
        'basic': { 
          options: ['Fixed', 'Casement'], 
          clarify: 'Basic windows can be fixed or casement. Which do you prefer?',
          confidence: 0.7
        },
        'standard': { 
          clarify: 'What type of window operation do you need? Fixed, Hung, Slider, Casement, or Awning?',
          confidence: 0.4
        },
        'typical': { 
          options: ['Fixed', 'Hung'], 
          clarify: 'Typical windows are often fixed or hung. Which would you prefer?',
          confidence: 0.6
        }
      },
      
      glass: {
        'standard': { 
          default: 'Double pane with Low-E & Argon', 
          clarify: 'Standard glass includes Low-E coating and argon fill. Is that good?',
          confidence: 0.8
        },
        'regular': { 
          default: 'Double pane', 
          clarify: 'Regular glass is double-pane clear. Is that what you need?',
          confidence: 0.7
        },
        'normal': { 
          default: 'Double pane', 
          clarify: 'Normal glass is typically double-pane. Is that what you want?',
          confidence: 0.6
        },
        'good': { 
          default: 'Double pane with Low-E & Argon', 
          clarify: 'Our good option is double-pane with Low-E and argon. Sound good?',
          confidence: 0.9
        },
        'better': { 
          default: 'Double pane with Low-E & Argon', 
          clarify: 'Our better option is double-pane with Low-E and argon. Would you like that?',
          confidence: 0.9
        },
        'best': { 
          default: 'Triple pane with Low-E & Argon', 
          clarify: 'Our best efficiency is triple-pane with Low-E and argon. Would you like that?',
          confidence: 0.9
        },
        'energy efficient': { 
          default: 'Double pane with Low-E & Argon', 
          clarify: 'For energy efficiency, I recommend double-pane with Low-E and argon. Is that good?',
          confidence: 0.8
        },
        'efficient': { 
          default: 'Double pane with Low-E & Argon', 
          clarify: 'For efficiency, double-pane with Low-E and argon is great. Sound good?',
          confidence: 0.8
        }
      },
      
      frame: {
        'standard': { 
          default: 'vinyl', 
          clarify: 'Standard frames are vinyl. Is that what you want?',
          confidence: 0.8
        },
        'regular': { 
          default: 'vinyl', 
          clarify: 'Regular frames are typically vinyl. Is that okay?',
          confidence: 0.7
        },
        'basic': { 
          default: 'vinyl', 
          clarify: 'Basic frames are vinyl. Would that work?',
          confidence: 0.8
        },
        'cheap': { 
          default: 'vinyl', 
          clarify: 'The most economical option is vinyl frames. Is that what you want?',
          confidence: 0.9
        },
        'expensive': { 
          default: 'wood', 
          clarify: 'Premium frames are typically wood. Is that what you\'re looking for?',
          confidence: 0.7
        }
      }
    };
  }
  
  /**
   * Detect ambiguities in a user message
   * @param {string} message - User's message text
   * @param {Object} currentSpecs - Current window specifications
   * @returns {Array} - Array of detected ambiguities
   */
  detectAmbiguity(message, currentSpecs = {}) {
    const ambiguities = [];
    const lowerMessage = message.toLowerCase();
    
    try {
      // Check for ambiguous size terms (only if size not already specified)
      if (!currentSpecs.width || !currentSpecs.height) {
        const sizeAmbiguities = this.detectSizeAmbiguities(lowerMessage);
        ambiguities.push(...sizeAmbiguities);
      }
      
      // Check for ambiguous type terms (only if operation type not specified)
      if (!currentSpecs.operation_type) {
        const typeAmbiguities = this.detectTypeAmbiguities(lowerMessage);
        ambiguities.push(...typeAmbiguities);
      }
      
      // Check for ambiguous glass terms (only if glass not specified)
      if (!currentSpecs.glass_type && !currentSpecs.pane_count) {
        const glassAmbiguities = this.detectGlassAmbiguities(lowerMessage);
        ambiguities.push(...glassAmbiguities);
      }
      
      // Check for ambiguous frame terms (only if frame not specified)
      if (!currentSpecs.frame_material) {
        const frameAmbiguities = this.detectFrameAmbiguities(lowerMessage);
        ambiguities.push(...frameAmbiguities);
      }
      
      // Sort by confidence (higher confidence first)
      ambiguities.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      
      if (ambiguities.length > 0) {
        logger.debug('Detected ambiguities in user message', {
          messagePreview: message.substring(0, 50),
          ambiguityCount: ambiguities.length,
          types: ambiguities.map(a => a.type)
        });
      }
      
      return ambiguities;
      
    } catch (error) {
      logger.logError(error, {
        operation: 'DETECT_AMBIGUITY',
        messagePreview: message.substring(0, 50)
      });
      
      return [];
    }
  }
  
  /**
   * Detect size-related ambiguities
   * @param {string} lowerMessage - Lowercase message text
   * @returns {Array} - Size ambiguities
   */
  detectSizeAmbiguities(lowerMessage) {
    const ambiguities = [];
    
    for (const [term, info] of Object.entries(this.ambiguousTerms.size)) {
      if (this.containsTerm(lowerMessage, term)) {
        ambiguities.push({
          type: 'size',
          term: term,
          suggestion: info.suggestion,
          clarifyMessage: info.clarify,
          confidence: info.confidence,
          originalTerm: term
        });
      }
    }
    
    return ambiguities;
  }
  
  /**
   * Detect operation type ambiguities
   * @param {string} lowerMessage - Lowercase message text
   * @returns {Array} - Type ambiguities
   */
  detectTypeAmbiguities(lowerMessage) {
    const ambiguities = [];
    
    for (const [term, info] of Object.entries(this.ambiguousTerms.type)) {
      if (this.containsTerm(lowerMessage, term)) {
        ambiguities.push({
          type: 'operation',
          term: term,
          options: info.options,
          clarifyMessage: info.clarify,
          confidence: info.confidence,
          originalTerm: term
        });
      }
    }
    
    return ambiguities;
  }
  
  /**
   * Detect glass type ambiguities
   * @param {string} lowerMessage - Lowercase message text
   * @returns {Array} - Glass ambiguities
   */
  detectGlassAmbiguities(lowerMessage) {
    const ambiguities = [];
    
    for (const [term, info] of Object.entries(this.ambiguousTerms.glass)) {
      if (this.containsTerm(lowerMessage, term)) {
        ambiguities.push({
          type: 'glass',
          term: term,
          default: info.default,
          clarifyMessage: info.clarify,
          confidence: info.confidence,
          originalTerm: term
        });
      }
    }
    
    return ambiguities;
  }
  
  /**
   * Detect frame material ambiguities
   * @param {string} lowerMessage - Lowercase message text
   * @returns {Array} - Frame ambiguities
   */
  detectFrameAmbiguities(lowerMessage) {
    const ambiguities = [];
    
    for (const [term, info] of Object.entries(this.ambiguousTerms.frame)) {
      if (this.containsTerm(lowerMessage, term)) {
        ambiguities.push({
          type: 'frame',
          term: term,
          default: info.default,
          clarifyMessage: info.clarify,
          confidence: info.confidence,
          originalTerm: term
        });
      }
    }
    
    return ambiguities;
  }
  
  /**
   * Check if a message contains a specific term (with word boundaries)
   * @param {string} message - Message text (lowercase)
   * @param {string} term - Term to search for
   * @returns {boolean} - Whether the term is found
   */
  containsTerm(message, term) {
    // Create word boundary regex for the term
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(message);
  }
  
  /**
   * Resolve an ambiguity based on user response
   * @param {Object} ambiguity - The ambiguity object
   * @param {string} userResponse - User's clarification response
   * @returns {Object|null} - Resolved specification object or null if not resolved
   */
  resolveAmbiguity(ambiguity, userResponse) {
    const lowerResponse = userResponse.toLowerCase();
    
    try {
      switch (ambiguity.type) {
        case 'size':
          return this.resolveSizeAmbiguity(ambiguity, lowerResponse);
          
        case 'operation':
          return this.resolveOperationAmbiguity(ambiguity, lowerResponse);
          
        case 'glass':
          return this.resolveGlassAmbiguity(ambiguity, lowerResponse);
          
        case 'frame':
          return this.resolveFrameAmbiguity(ambiguity, lowerResponse);
          
        default:
          logger.warn('Unknown ambiguity type for resolution', {
            type: ambiguity.type,
            term: ambiguity.term
          });
          return null;
      }
    } catch (error) {
      logger.logError(error, {
        operation: 'RESOLVE_AMBIGUITY',
        ambiguityType: ambiguity.type,
        term: ambiguity.term
      });
      
      return null;
    }
  }
  
  /**
   * Resolve size ambiguity
   * @param {Object} ambiguity - Size ambiguity object
   * @param {string} lowerResponse - User response (lowercase)
   * @returns {Object|null} - Resolved size specs or null
   */
  resolveSizeAmbiguity(ambiguity, lowerResponse) {
    // Check if they agreed with suggestion
    if (lowerResponse.includes('yes') || 
        lowerResponse.includes('correct') || 
        lowerResponse.includes('right') ||
        lowerResponse.includes('that works') ||
        lowerResponse.includes('sounds good')) {
      
      const [width, height] = ambiguity.suggestion.split('x').map(Number);
      return { width, height };
    }
    
    // Check if they provided different dimensions
    const dimensionMatch = lowerResponse.match(/(\d+)\s*[x×by]\s*(\d+)/);
    if (dimensionMatch) {
      return {
        width: parseInt(dimensionMatch[1]),
        height: parseInt(dimensionMatch[2])
      };
    }
    
    // Check for single dimension (might be width or height)
    const singleDimMatch = lowerResponse.match(/(\d+)\s*inch/);
    if (singleDimMatch) {
      // This is ambiguous itself - would need follow-up
      return {
        ambiguous_dimension: parseInt(singleDimMatch[1])
      };
    }
    
    return null;
  }
  
  /**
   * Resolve operation type ambiguity
   * @param {Object} ambiguity - Operation ambiguity object
   * @param {string} lowerResponse - User response (lowercase)
   * @returns {Object|null} - Resolved operation specs or null
   */
  resolveOperationAmbiguity(ambiguity, lowerResponse) {
    // Check if they chose one of the suggested options
    if (ambiguity.options) {
      for (const option of ambiguity.options) {
        if (lowerResponse.includes(option.toLowerCase())) {
          return { operation_type: option.toLowerCase() };
        }
      }
    }
    
    // Check for other known operation types
    const operationTypes = ['fixed', 'hung', 'slider', 'casement', 'awning', 'hopper'];
    for (const type of operationTypes) {
      if (lowerResponse.includes(type)) {
        return { operation_type: type };
      }
    }
    
    // Check for descriptive terms
    if (lowerResponse.includes('open') || lowerResponse.includes('opens')) {
      if (lowerResponse.includes('up') || lowerResponse.includes('down')) {
        return { operation_type: 'hung' };
      }
      if (lowerResponse.includes('side') || lowerResponse.includes('left') || lowerResponse.includes('right')) {
        return { operation_type: 'slider' };
      }
      if (lowerResponse.includes('crank') || lowerResponse.includes('handle')) {
        return { operation_type: 'casement' };
      }
    }
    
    if (lowerResponse.includes('don\'t open') || lowerResponse.includes('doesn\'t open') || lowerResponse.includes('no opening')) {
      return { operation_type: 'fixed' };
    }
    
    return null;
  }
  
  /**
   * Resolve glass type ambiguity
   * @param {Object} ambiguity - Glass ambiguity object
   * @param {string} lowerResponse - User response (lowercase)
   * @returns {Object|null} - Resolved glass specs or null
   */
  resolveGlassAmbiguity(ambiguity, lowerResponse) {
    // Check if they agreed with default
    if (lowerResponse.includes('yes') || 
        lowerResponse.includes('good') || 
        lowerResponse.includes('that works') ||
        lowerResponse.includes('sounds good') ||
        lowerResponse.includes('perfect')) {
      
      return this.parseGlassDefault(ambiguity.default);
    }
    
    // Check if they want something different
    if (lowerResponse.includes('no') || 
        lowerResponse.includes('different') ||
        lowerResponse.includes('something else')) {
      
      // Return indication that they want different glass
      return { needs_different_glass: true };
    }
    
    return null;
  }
  
  /**
   * Resolve frame material ambiguity
   * @param {Object} ambiguity - Frame ambiguity object
   * @param {string} lowerResponse - User response (lowercase)
   * @returns {Object|null} - Resolved frame specs or null
   */
  resolveFrameAmbiguity(ambiguity, lowerResponse) {
    // Check if they agreed with default
    if (lowerResponse.includes('yes') || 
        lowerResponse.includes('okay') || 
        lowerResponse.includes('that works') ||
        lowerResponse.includes('sounds good')) {
      
      return { frame_material: ambiguity.default };
    }
    
    // Check for other frame materials
    const frameMaterials = ['vinyl', 'wood', 'aluminum', 'fiberglass'];
    for (const material of frameMaterials) {
      if (lowerResponse.includes(material)) {
        return { frame_material: material };
      }
    }
    
    return null;
  }
  
  /**
   * Parse glass default string into specification object
   * @param {string} glassDescription - Glass description string
   * @returns {Object} - Glass specification object
   */
  parseGlassDefault(glassDescription) {
    const specs = {
      glass_type: 'clear'
    };
    
    // Determine pane count
    if (glassDescription.includes('Triple')) {
      specs.pane_count = 3;
    } else if (glassDescription.includes('Double')) {
      specs.pane_count = 2;
    } else {
      specs.pane_count = 2; // Default to double
    }
    
    // Check for Low-E
    specs.has_low_e = glassDescription.includes('Low-E');
    
    // Check for Argon
    specs.has_argon = glassDescription.includes('Argon');
    
    return specs;
  }
  
  /**
   * Get the most confident ambiguity from a list
   * @param {Array} ambiguities - Array of ambiguity objects
   * @returns {Object|null} - Most confident ambiguity or null
   */
  getMostConfidentAmbiguity(ambiguities) {
    if (!ambiguities || ambiguities.length === 0) {
      return null;
    }
    
    // Already sorted by confidence in detectAmbiguity
    return ambiguities[0];
  }
}

module.exports = AmbiguityDetector;