/**
 * Window Specification Parser
 * Extracts structured window specifications from conversation context
 */

const logger = require('./logger');

/**
 * Extract dimension measurements from text
 * @param {string} text - The text to extract from
 * @returns {Object|null} - The extracted width and height, or null if not found
 */
function extractDimensions(text) {
  // Look for patterns like: 36 x 48 inches, 36" by 48", 36 inches by 48 inches, etc.
  const dimensionPatterns = [
    /(\d+)\s*(?:x|by|\*)\s*(\d+)(?:\s*(?:inches|inch|"|in))?/i,
    /(\d+)(?:\s*(?:inches|inch|"|in))?\s*(?:x|by|\*)\s*(\d+)(?:\s*(?:inches|inch|"|in))?/i,
    /width(?:\s*(?:is|of))?\s*(\d+)(?:\s*(?:inches|inch|"|in))?.*?height(?:\s*(?:is|of))?\s*(\d+)(?:\s*(?:inches|inch|"|in))?/i,
    /(\d+)(?:\s*(?:inches|inch|"|in))?\s*(?:wide|width).*?(\d+)(?:\s*(?:inches|inch|"|in))?\s*(?:tall|height)/i
  ];
  
  for (const pattern of dimensionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      
      // Validate reasonable dimensions
      if (width > 0 && width < 200 && height > 0 && height < 200) {
        return { width, height };
      }
    }
  }
  
  return null;
}

/**
 * Extract window type from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - The extracted window type, or null if not found
 */
function extractWindowType(text) {
  const lowerText = text.toLowerCase();
  
  // Check for specific window types
  if (lowerText.includes('standard window') || lowerText.includes('standard type')) {
    return 'Standard';
  }
  
  if (lowerText.includes('bay window')) {
    return 'Bay';
  }
  
  if (lowerText.includes('shaped window') || lowerText.includes('custom shape')) {
    return 'Shaped';
  }
  
  // Check for explicit type mentions
  const typePattern = /(?:window|it)\s+(?:is|should be|will be)\s+(?:a\s+)?(\w+)/i;
  const match = text.match(typePattern);
  
  if (match) {
    const type = match[1].toLowerCase();
    if (type === 'standard' || type === 'regular' || type === 'normal') {
      return 'Standard';
    }
    if (type === 'bay') {
      return 'Bay';
    }
    if (type === 'shaped' || type === 'custom') {
      return 'Shaped';
    }
  }
  
  return null;
}

/**
 * Extract glass type from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - The extracted glass type, or null if not found
 */
function extractGlassType(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('double pane') || lowerText.includes('double-pane')) {
    return 'Double pane';
  }
  
  if (lowerText.includes('triple pane') || lowerText.includes('triple-pane')) {
    return 'Triple pane';
  }
  
  // Check for explicit glass mentions
  const glassPattern = /(?:glass|pane|it)\s+(?:is|should be|will be)\s+(?:a\s+)?(\w+)/i;
  const match = text.match(glassPattern);
  
  if (match) {
    const type = match[1].toLowerCase();
    if (type === 'double') {
      return 'Double pane';
    }
    if (type === 'triple') {
      return 'Triple pane';
    }
  }
  
  return null;
}

/**
 * Extract room/location from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - The extracted location, or null if not found
 */
function extractLocation(text) {
  const lowerText = text.toLowerCase();
  
  // Common room types
  const rooms = [
    'kitchen', 'bedroom', 'living room', 'bathroom', 'dining room', 
    'family room', 'office', 'basement', 'attic', 'garage', 'laundry room'
  ];
  
  for (const room of rooms) {
    if (lowerText.includes(room)) {
      return room.charAt(0).toUpperCase() + room.slice(1); // Capitalize first letter
    }
  }
  
  // Check for explicit location mentions
  const locationPattern = /(?:room|location|it)\s+(?:is|in)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i;
  const match = text.match(locationPattern);
  
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  
  return null;
}

/**
 * Extract special features from text
 * @param {string} text - The text to extract from
 * @returns {Array} - The extracted features
 */
function extractFeatures(text) {
  const lowerText = text.toLowerCase();
  const features = [];
  
  if (lowerText.includes('grille') || lowerText.includes('grid')) {
    features.push('Grilles');
  }
  
  if ((lowerText.includes('low-e') || lowerText.includes('low e')) && lowerText.includes('argon')) {
    features.push('Low-E glass with argon');
  } else if (lowerText.includes('low-e') || lowerText.includes('low e')) {
    features.push('Low-E glass');
  }
  
  return features;
}

/**
 * Parse conversation messages to extract window specifications
 * @param {Array} messages - Array of conversation messages
 * @returns {Object} - Extracted window specifications
 */
function parseWindowSpecifications(messages) {
  const specs = {
    location: null,
    width: null,
    height: null,
    window_type: null,
    glass_type: null,
    features: []
  };
  
  // Combine all message content into a single string for analysis
  const fullText = messages
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content)
    .join(' ');
  
  // Extract dimensions
  const dimensions = extractDimensions(fullText);
  if (dimensions) {
    specs.width = dimensions.width;
    specs.height = dimensions.height;
  }
  
  // Extract other specifications
  specs.window_type = extractWindowType(fullText);
  specs.glass_type = extractGlassType(fullText);
  specs.location = extractLocation(fullText);
  specs.features = extractFeatures(fullText);
  
  // Check if we have enough data to consider this a complete specification
  const isComplete = specs.location && specs.width && specs.height && 
                     specs.window_type && specs.glass_type;
  
  logger.debug('Parsed window specifications', { 
    specs, 
    is_complete: isComplete 
  });
  
  return {
    ...specs,
    is_complete: isComplete
  };
}

module.exports = {
  parseWindowSpecifications,
  extractDimensions,
  extractWindowType,
  extractGlassType,
  extractLocation,
  extractFeatures
};