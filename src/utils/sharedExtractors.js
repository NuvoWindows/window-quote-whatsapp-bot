/**
 * Shared extraction methods used by both messageParser and windowSpecParser
 * This eliminates code duplication while maintaining separate parsers for different use cases
 */

const logger = require('./logger');

/**
 * Extract window operation type from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - Operation type or null if not found
 */
function extractOperationType(text) {
  const lowerText = text.toLowerCase();
  
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
      if (lowerText.includes(keyword)) {
        return type;
      }
    }
  }
  
  // Look for more complex patterns
  const patternMatches = [
    { pattern: /opens?\s+(?:from|on)\s+(?:the\s+)?side/i, type: 'Casement' },
    { pattern: /opens?\s+(?:from|at)\s+(?:the\s+)?top/i, type: 'Awning' },
    { pattern: /slides?\s+(?:up|up\s+and\s+down|vertically)/i, type: 'Hung' },
    { pattern: /slides?\s+(?:side\s+to\s+side|horizontally|left|right)/i, type: 'Slider' },
    { pattern: /(?:doesn't|does\s+not|won't|cannot|can't)\s+open/i, type: 'Fixed' },
    { pattern: /(?:with|has)\s+(?:a\s+)?crank/i, type: 'Casement' }
  ];
  
  for (const { pattern, type } of patternMatches) {
    if (pattern.test(lowerText)) {
      return type;
    }
  }
  
  return null;
}

/**
 * Extract window dimensions from text
 * @param {string} text - The text to extract from
 * @returns {Object|null} - Width and height or null if not found
 */
function extractDimensions(text) {
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
    const match = text.match(pattern);
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
      
      // Return dimensions without validation (let windowValidator handle it)
      return {
        width,
        height,
        originalUnits: matchText.match(/cm|centimeters|mm|millimeters|m|meters|ft|feet|in|inch|inches/i)?.[0] || 'inches'
      };
    }
  }
  
  return null;
}

/**
 * Extract location information from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - Location or null if not found
 */
function extractLocation(text) {
  const lowerText = text.toLowerCase();
  
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
  
  // Check for exact room matches - sort by length to match longer phrases first
  const sortedRooms = rooms.sort((a, b) => b.length - a.length);
  for (const room of sortedRooms) {
    if (lowerText.includes(room)) {
      // Capitalize each word in the room name
      return room.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
  }
  
  // Check for location patterns
  for (const pattern of locationPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
  }
  
  return null;
}

/**
 * Extract window type from text
 * @param {string} text - The text to extract from
 * @returns {string} - Window type (standard, bay, shaped)
 */
function extractWindowType(text) {
  const lowerText = text.toLowerCase();
  
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
    if (pattern.test(lowerText)) {
      return 'bay';
    }
  }
  
  // Check for shaped windows
  for (const pattern of shapedPatterns) {
    if (pattern.test(lowerText)) {
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
    if (pattern.test(lowerText)) {
      return 'standard';
    }
  }
  
  // Default to standard if not found
  return 'standard';
}

/**
 * Extract pane count from text
 * @param {string} text - The text to extract from
 * @returns {number} - Pane count (2 or 3)
 */
function extractPaneCount(text) {
  const lowerText = text.toLowerCase();
  
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
    if (pattern.test(lowerText)) {
      return 3;
    }
  }
  
  // Default to double pane (single pane not offered)
  return 2;
}

/**
 * Extract glass type from text (alternative to pane count)
 * @param {string} text - The text to extract from
 * @returns {string} - Glass type
 */
function extractGlassType(text) {
  const lowerText = text.toLowerCase();
  
  if (/triple/i.test(lowerText)) {
    return 'Triple pane';
  }
  
  // Default to double pane
  return 'Double pane';
}

/**
 * Extract window options from text
 * @param {string} text - The text to extract from
 * @returns {Object} - Window options
 */
function extractOptions(text) {
  const lowerText = text.toLowerCase();
  
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
    if (pattern.test(lowerText)) {
      options.lowE = true;
      break;
    }
  }
  
  // Check for grilles
  for (const pattern of grillePatterns) {
    if (pattern.test(lowerText)) {
      options.grilles = true;
      break;
    }
  }
  
  // Check for glass types
  for (const pattern of frostPatterns) {
    if (pattern.test(lowerText)) {
      options.glassType = 'frosted';
      break;
    }
  }
  
  if (options.glassType === 'clear') {
    for (const pattern of tintPatterns) {
      if (pattern.test(lowerText)) {
        options.glassType = 'tinted';
        break;
      }
    }
  }
  
  return options;
}

/**
 * Extract features array from text (windowSpecParser format)
 * @param {string} text - The text to extract from
 * @returns {Array<string>} - Extracted features
 */
function extractFeatures(text) {
  const features = [];
  const options = extractOptions(text);
  
  if (options.lowE) {
    features.push('Low-E glass with argon');
  }
  
  if (options.grilles) {
    features.push('Grilles');
  }
  
  if (options.glassType !== 'clear') {
    features.push(`${options.glassType.charAt(0).toUpperCase()}${options.glassType.slice(1)} glass`);
  }
  
  return features;
}

module.exports = {
  extractOperationType,
  extractDimensions,
  extractLocation,
  extractWindowType,
  extractPaneCount,
  extractGlassType,
  extractOptions,
  extractFeatures
};