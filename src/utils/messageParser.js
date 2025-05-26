/**
 * Message Parser
 * Extracts window specifications from user messages
 */

const logger = require('./logger');
const { extractOperationType, extractDimensions, extractLocation, extractWindowType, extractPaneCount, extractOptions } = require('./sharedExtractors');
const windowValidator = require('./windowValidator');

class MessageParser {
    /**
     * Extract window dimensions from message text
     * Delegates to shared extractor
     * @param {string} message - Message text
     * @returns {Object|null} - Extracted dimensions or null if not found
     */
    extractDimensions(message) {
      return extractDimensions(message);
    }
    
    /**
     * Legacy implementation kept for reference
     * @deprecated Use extractDimensions from sharedExtractors
     */
    _extractDimensionsOld(message) {
      // Look for patterns like "36x48" or "36 by 48" or "36 inches by 48 inches"
      const patterns = [
        /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*by\s*(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*width.*?(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*height/i,
        /width\s*(?:is|:)?\s*(\d+(?:\.\d+)?).+?height\s*(?:is|:)?\s*(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|cm|centimeters|mm|millimeters|m|meters|ft|feet)?\s*[x×]\s*(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|cm|centimeters|mm|millimeters|m|meters|ft|feet)?\s*(?:wide|width).*?(\d+(?:\.\d+)?)\s*(?:in|inch|inches|cm|centimeters|mm|millimeters|m|meters|ft|feet)?\s*(?:high|height|tall)/i
      ];
      
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
          // Extract the values
          let width = parseFloat(match[1]);
          let height = parseFloat(match[2]);
          
          // Check for unit indicators and convert to inches if needed
          const unitIndicators = [
            { pattern: /cm|centimeters/i, factor: 0.393701 }, // cm to inches
            { pattern: /mm|millimeters/i, factor: 0.0393701 }, // mm to inches
            { pattern: /m|meters/i, factor: 39.3701 }, // m to inches
            { pattern: /ft|feet/i, factor: 12 } // feet to inches
          ];
          
          // Check for units in the full match string
          const matchText = match[0];
          for (const unitInfo of unitIndicators) {
            if (unitInfo.pattern.test(matchText)) {
              // If units are specified, convert to inches
              width = width * unitInfo.factor;
              height = height * unitInfo.factor;
              break;
            }
          }
          
          // Round to nearest 0.1 inch for practical dimensions
          width = Math.round(width * 10) / 10;
          height = Math.round(height * 10) / 10;
          
          // Validate reasonable dimensions
          if (width > 5 && width < 120 && height > 5 && height < 120) {
            return {
              width,
              height,
              originalUnits: matchText.match(/cm|centimeters|mm|millimeters|m|meters|ft|feet|in|inch|inches/i)?.[0] || 'inches'
            };
          }
        }
      }
      
      return null;
    }
    
    /**
     * Extract window operation type from message text
     * Delegates to shared extractor
     * @param {string} message - Message text
     * @returns {string|null} - Operation type or null if not found
     */
    extractOperationType(message) {
      return extractOperationType(message);
    }
    
    /**
     * Legacy implementation kept for reference
     * @deprecated Use extractOperationType from sharedExtractors
     */
    _extractOperationTypeOld(message) {
      const lowerMessage = message.toLowerCase();
      
      // Define operation type keywords and variations
      const operationTypes = {
        'Hung': [
          'hung window', 'hung type', 'double hung', 'single hung', 
          'double-hung', 'single-hung', 'hung style', 'dh window',
          'hung operation', 'up and down window', 'vertical sliding'
        ],
        'Slider': [
          'slider', 'sliding window', 'horizontal sliding', 'gliding window',
          'slide window', 'side sliding', 'side to side window', 'sliding operation'
        ],
        'Fixed': [
          'fixed window', 'fixed pane', 'non-opening', 'picture window',
          'stationary window', 'fixed operation', 'does not open', 'non-operational',
          'non-operable', 'inoperable', 'static window'
        ],
        'Casement': [
          'casement', 'crank out', 'cranking window', 'swing out',
          'hinged window', 'casement operation', 'outward opening',
          'side hinged', 'crank-out', 'cranking operation', 'crank handle'
        ],
        'Awning': [
          'awning', 'top hinged', 'top-hinged', 'hinged at top',
          'projects outward', 'awning style', 'awning type',
          'outward from top', 'top-hung', 'top hung'
        ]
      };
      
      // Check for explicit type mentions
      for (const [type, keywords] of Object.entries(operationTypes)) {
        for (const keyword of keywords) {
          if (lowerMessage.includes(keyword)) {
            return type;
          }
        }
      }
      
      // Look for more complex patterns
      const patternMatches = [
        // Pattern: "window that opens from the side"
        { pattern: /opens?\s+(?:from|on)\s+(?:the\s+)?side/i, type: 'Casement' },
        // Pattern: "window that opens from the top"
        { pattern: /opens?\s+(?:from|at)\s+(?:the\s+)?top/i, type: 'Awning' },
        // Pattern: "window that slides up and down"
        { pattern: /slides?\s+(?:up|up\s+and\s+down|vertically)/i, type: 'Hung' },
        // Pattern: "window that slides side to side"
        { pattern: /slides?\s+(?:side\s+to\s+side|horizontally|left|right)/i, type: 'Slider' },
        // Pattern: "window that doesn't open"
        { pattern: /(?:doesn't|does\s+not|won't|cannot|can't)\s+open/i, type: 'Fixed' },
        // Pattern: "a window with a crank"
        { pattern: /(?:with|has)\s+(?:a\s+)?crank/i, type: 'Casement' }
      ];
      
      for (const { pattern, type } of patternMatches) {
        if (pattern.test(lowerMessage)) {
          return type;
        }
      }
      
      // Default to Hung if no operation type is found
      return null;
    }
    
    /**
     * Extract window type from message text
     * Delegates to shared extractor
     * @param {string} message - Message text
     * @returns {string} - Window type (standard, bay, shaped)
     */
    extractWindowType(message) {
      return extractWindowType(message);
    }
    
    /**
     * Legacy implementation kept for reference
     * @deprecated Use extractWindowType from sharedExtractors
     */
    _extractWindowTypeOld(message) {
      const lowerMessage = message.toLowerCase();
      
      // Bay window patterns
      const bayPatterns = [
        /bay window/i,
        /bow window/i,
        /bay style/i,
        /bay shaped/i,
        /window that protrudes/i,
        /extends? (?:out|from) (?:the|from) (?:wall|house|building)/i
      ];
      
      // Shaped window patterns
      const shapedPatterns = [
        /shaped window/i,
        /arch(?:ed)? (?:window|top)/i,
        /half(?:\s+|-)?round/i,
        /quarter(?:\s+|-)?round/i,
        /circle(?:\s+|-)?top/i,
        /eyebrow window/i,
        /oval window/i,
        /round (?:window|top)/i,
        /custom shape/i,
        /geometric window/i,
        /specialty (?:window|shape)/i,
        /triangle|triangular/i,
        /trapezoid/i,
        /hexagon/i,
        /octagon/i
      ];
      
      // Check for bay windows
      for (const pattern of bayPatterns) {
        if (pattern.test(lowerMessage)) {
          return 'bay';
        }
      }
      
      // Check for shaped windows
      for (const pattern of shapedPatterns) {
        if (pattern.test(lowerMessage)) {
          return 'shaped';
        }
      }
      
      // Standard window patterns
      const standardPatterns = [
        /standard window/i,
        /regular window/i,
        /normal window/i,
        /rectangular window/i,
        /square window/i
      ];
      
      // Check for standard windows
      for (const pattern of standardPatterns) {
        if (pattern.test(lowerMessage)) {
          return 'standard';
        }
      }
      
      // Default to standard if not found
      return 'standard';
    }
    
    /**
     * Extract pane count from message text
     * Delegates to shared extractor
     * @param {string} message - Message text
     * @returns {number} - Pane count (2 or 3)
     */
    extractPaneCount(message) {
      return extractPaneCount(message);
    }
    
    /**
     * Legacy implementation kept for reference
     * @deprecated Use extractPaneCount from sharedExtractors
     */
    _extractPaneCountOld(message) {
      const lowerMessage = message.toLowerCase();
      
      // Triple pane patterns
      const triplePatterns = [
        /triple pane/i,
        /triple[- ]glazed/i,
        /three panes?/i,
        /3 panes?/i,
        /triple[- ]insulated/i
      ];
      
      // Check for triple pane
      for (const pattern of triplePatterns) {
        if (pattern.test(lowerMessage)) {
          return 3;
        }
      }
      
      // Default to double pane (single pane not offered)
      return 2;
    }
    
    /**
     * Extract window options from message text
     * Delegates to shared extractor
     * @param {string} message - Message text
     * @returns {Object} - Window options
     */
    extractOptions(message) {
      return extractOptions(message);
    }
    
    /**
     * Legacy implementation kept for reference
     * @deprecated Use extractOptions from sharedExtractors
     */
    _extractOptionsOld(message) {
      const lowerMessage = message.toLowerCase();
      
      // Initialize options object
      const options = {
        lowE: false,
        grilles: false,
        glassType: 'clear'
      };
      
      // Low-E glass patterns
      const lowEPatterns = [
        /low[- ]e/i,
        /low emissivity/i,
        /energy efficient glass/i,
        /energy[- ]saving glass/i,
        /energy star/i,
        /energy rated/i,
        /argon/i  // Argon is typically used with Low-E
      ];
      
      // Grilles patterns
      const grillePatterns = [
        /grille/i,
        /grid/i,
        /divided light/i,
        /muntins?/i,
        /mullions?/i,
        /window dividers/i
      ];
      
      // Glass type patterns
      const frostPatterns = [
        /frosted/i,
        /privacy glass/i,
        /obscure(?:d)? glass/i,
        /satin glass/i,
        /acid[- ]etched/i,
        /sandblasted/i
      ];
      
      const tintPatterns = [
        /tinted/i,
        /gray glass/i,
        /grey glass/i,
        /bronze glass/i,
        /blue glass/i,
        /green glass/i
      ];
      
      // Check for Low-E glass
      for (const pattern of lowEPatterns) {
        if (pattern.test(lowerMessage)) {
          options.lowE = true;
          break;
        }
      }
      
      // Check for grilles
      for (const pattern of grillePatterns) {
        if (pattern.test(lowerMessage)) {
          options.grilles = true;
          break;
        }
      }
      
      // Check for glass types
      for (const pattern of frostPatterns) {
        if (pattern.test(lowerMessage)) {
          options.glassType = 'frosted';
          break;
        }
      }
      
      if (options.glassType === 'clear') {
        for (const pattern of tintPatterns) {
          if (pattern.test(lowerMessage)) {
            options.glassType = 'tinted';
            break;
          }
        }
      }
      
      return options;
    }
    
    /**
     * Extract color options from message text
     * @param {string} message - Message text
     * @returns {Object} - Color options
     */
    extractColorOptions(message) {
      const lowerMessage = message.toLowerCase();
      
      // Initialize color options
      const colors = {
        hasInteriorColor: false,
        hasExteriorColor: false
      };
      
      // Interior color patterns
      const interiorColorPatterns = [
        /interior(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i,
        /inside(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i,
        /(?!white)[a-z]+\s+(?:color|finish)\s+(?:on\s+the\s+)?(?:interior|inside)/i
      ];
      
      // Exterior color patterns
      const exteriorColorPatterns = [
        /exterior(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i,
        /outside(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i,
        /(?!white)[a-z]+\s+(?:color|finish)\s+(?:on\s+the\s+)?(?:exterior|outside)/i
      ];
      
      // Non-white color mentions
      const nonWhiteColorPatterns = [
        /black\s+(?:frame|window)/i,
        /dark\s+(?:frame|finish)/i,
        /bronze\s+(?:frame|finish)/i,
        /tan\s+(?:frame|window)/i,
        /beige\s+(?:frame|window)/i,
        /brown\s+(?:frame|window)/i,
        /colored\s+(?:frame|window)/i,
        /painted\s+(?:frame|window)/i
      ];
      
      // Check for interior color
      for (const pattern of interiorColorPatterns) {
        if (pattern.test(lowerMessage)) {
          colors.hasInteriorColor = true;
          break;
        }
      }
      
      // Check for exterior color
      for (const pattern of exteriorColorPatterns) {
        if (pattern.test(lowerMessage)) {
          colors.hasExteriorColor = true;
          break;
        }
      }
      
      // Check for generic color mentions if specific interior/exterior not found
      if (!colors.hasInteriorColor && !colors.hasExteriorColor) {
        for (const pattern of nonWhiteColorPatterns) {
          if (pattern.test(lowerMessage)) {
            // If color is mentioned but not specified, assume both interior and exterior
            colors.hasInteriorColor = true;
            colors.hasExteriorColor = true;
            break;
          }
        }
      }
      
      return colors;
    }
    
    /**
     * Extract quantity information from message text
     * @param {string} message - Message text
     * @returns {number} - Quantity (default: 1)
     */
    extractQuantity(message) {
      const lowerMessage = message.toLowerCase();
      
      // Check for explicit quantity mentions
      const quantityPatterns = [
        /(\d+)\s+windows?/i,
        /need\s+(\d+)/i,
        /want\s+(\d+)/i,
        /looking\s+for\s+(\d+)/i,
        /quantity\s+(?:of\s+)?(\d+)/i,
        /(\d+)\s+(?:of\s+)?(?:these|them)/i
      ];
      
      for (const pattern of quantityPatterns) {
        const match = lowerMessage.match(pattern);
        if (match) {
          const quantity = parseInt(match[1], 10);
          if (quantity > 0 && quantity < 100) { // Reasonable range check
            return quantity;
          }
        }
      }
      
      // Check for written numbers
      const writtenNumbers = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'fifteen': 15, 'twenty': 20
      };
      
      for (const [word, value] of Object.entries(writtenNumbers)) {
        const pattern = new RegExp(`${word}\\s+windows?`, 'i');
        if (pattern.test(lowerMessage)) {
          return value;
        }
      }
      
      // Default to 1 if no quantity is found
      return 1;
    }
    
    /**
     * Extract location information from message text
     * Delegates to shared extractor
     * @param {string} message - Message text
     * @returns {string|null} - Location or null if not found
     */
    extractLocation(message) {
      return extractLocation(message);
    }
    
    /**
     * Legacy implementation kept for reference
     * @deprecated Use extractLocation from sharedExtractors
     */
    _extractLocationOld(message) {
      const lowerMessage = message.toLowerCase();
      
      // Common room types
      const rooms = [
        'kitchen', 'bedroom', 'master bedroom', 'living room', 'family room',
        'dining room', 'bathroom', 'basement', 'attic', 'garage', 'laundry room',
        'office', 'study', 'den', 'guest room', 'hallway', 'entryway', 'foyer',
        'sunroom', 'porch', 'patio', 'front door', 'back door', 'side door'
      ];
      
      // Location patterns
      const locationPatterns = [
        /in\s+(?:the\s+|my\s+|our\s+)?([a-z\s]+room)/i,
        /for\s+(?:the\s+|my\s+|our\s+)?([a-z\s]+room)/i,
        /for\s+(?:the\s+|my\s+|our\s+)?([a-z\s]+door)/i,
        /for\s+(?:the\s+|my\s+|our\s+)?([a-z\s]+area)/i,
        /in\s+(?:the\s+|my\s+|our\s+)?([a-z\s]+area)/i
      ];
      
      // Check for exact room matches
      for (const room of rooms) {
        if (lowerMessage.includes(room)) {
          return room.charAt(0).toUpperCase() + room.slice(1);
        }
      }
      
      // Check for location patterns
      for (const pattern of locationPatterns) {
        const match = lowerMessage.match(pattern);
        if (match) {
          return match[1].charAt(0).toUpperCase() + match[1].slice(1);
        }
      }
      
      return null;
    }
    
    /**
     * Extract all window specifications from a message
     * @param {string} message - Message text
     * @returns {Object} - Extracted specifications
     */
    extractAllSpecifications(message) {
      // Extract specifications
      const dimensions = this.extractDimensions(message);
      const operationType = this.extractOperationType(message);
      const windowType = this.extractWindowType(message);
      const paneCount = this.extractPaneCount(message);
      const options = this.extractOptions(message);
      const colorOptions = this.extractColorOptions(message);
      const quantity = this.extractQuantity(message);
      const location = this.extractLocation(message);
      
      // Combine into one specifications object
      const specs = {
        width: dimensions?.width || null,
        height: dimensions?.height || null,
        originalUnits: dimensions?.originalUnits || 'inches',
        operation_type: operationType || 'Hung', // Default to Hung
        window_type: windowType,
        pane_count: paneCount,
        glass_type: options.glassType,
        has_low_e: options.lowE,
        has_grilles: options.grilles,
        has_interior_color: colorOptions.hasInteriorColor,
        has_exterior_color: colorOptions.hasExteriorColor,
        quantity: quantity,
        location: location,
        is_complete: !!(dimensions?.width && dimensions?.height)
      };
      
      // Log extracted specifications
      logger.debug('Extracted window specifications', specs);
      
      return specs;
    }
    
    /**
     * Extract specifications and validate them
     * @param {string} message - Message text to parse and validate
     * @returns {Object} - Specs with validation results
     */
    extractAndValidateSpecifications(message) {
      // Extract specifications
      const specs = this.extractAllSpecifications(message);
      
      // Validate specifications
      const validationResult = windowValidator.validateWindowSpecifications(specs);
      
      // Add validation results to specs
      specs.validation = validationResult;
      
      // Format user-friendly validation message if there are issues
      if (!validationResult.isValid) {
        specs.validationMessage = windowValidator.formatValidationMessage(validationResult);
      }
      
      return specs;
    }
  }
  
  module.exports = new MessageParser();