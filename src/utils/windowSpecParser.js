/**
 * Window Specification Parser
 * Extracts structured window specifications from conversation context
 */

const logger = require('./logger');
const sharedExtractors = require('./sharedExtractors');

/**
 * Extract detailed information about a shaped window
 * @param {string} text - The text to extract from
 * @returns {Object|null} - The extracted shaped window details, or null if not appropriate
 */
function extractShapedWindowDetails(text) {
  if (!text.toLowerCase().includes('shaped') && 
      !text.toLowerCase().includes('arch') && 
      !text.toLowerCase().includes('round')) {
    return null;
  }

  const details = {
    isArched: false
    // Arch details not used in pricing
  };
  
  const lowerText = text.toLowerCase();
  
  // Determine if the window has an arched top
  if (/(arch(?:ed)?|half(?:\s*|-)?round|circle(?:\s*|-)?top)/i.test(lowerText)) {
    details.isArched = true;
    
    // Arch type and height extraction removed - not used in pricing
  // Shape type extraction removed - not used in pricing
  }
  
  return details;
}

/**
 * Extract bay window details from text
 * @param {string} text - The text to extract from
 * @returns {Object|null} - The extracted bay window details, or null if not appropriate
 */
function extractBayWindowDetails(text) {
  if (!text.toLowerCase().includes('bay')) {
    return null;
  }
  
  const details = {
    // Panel count and angle not used in pricing
    sidingArea: null // Square footage of siding, if mentioned
  };
  
  const lowerText = text.toLowerCase();
  
  // Panel count and angle extraction removed - not used in pricing
  
  // Try to extract siding area
  const sidingPatterns = [
    /siding(?:\s+area)?\s+(?:of)?\s+(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s+(?:sq\.?|square)\s*(?:ft\.?|feet|foot)/i
  ];
  
  for (const pattern of sidingPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      details.sidingArea = parseFloat(match[1]);
      break;
    }
  }
  
  return details;
}

/**
 * Extract operation type from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - The extracted operation type, or null if not found
 */
// Use shared extractor for operation type
const extractOperationType = sharedExtractors.extractOperationType;

// Legacy implementation kept for reference
function _extractOperationTypeOld(text) {
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
    if (pattern.test(lowerText)) {
      return type;
    }
  }
  
  // Default to Hung if no operation type is found
  return null;
}

/**
 * Extract dimension measurements from text
 * @param {string} text - The text to extract from
 * @returns {Object|null} - The extracted width and height, or null if not found
 */
// Use shared extractor for dimensions
const extractDimensions = sharedExtractors.extractDimensions;

// Legacy implementation kept for reference
function _extractDimensionsOld(text) {
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
// Use shared extractor for window type (but with capitalized return values)
function extractWindowType(text) {
  const type = sharedExtractors.extractWindowType(text);
  // Capitalize first letter to match existing behavior
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// Legacy implementation kept for reference
function _extractWindowTypeOld(text) {
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
      return 'Bay';
    }
  }
  
  // Check for shaped windows
  for (const pattern of shapedPatterns) {
    if (pattern.test(lowerText)) {
      return 'Shaped';
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
      return 'Standard';
    }
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
  
  return 'Standard'; // Default to standard
}

/**
 * Extract glass type from text
 * @param {string} text - The text to extract from
 * @returns {string|null} - The extracted glass type, or null if not found
 */
// Use shared extractor for glass type
const extractGlassType = sharedExtractors.extractGlassType;

// Legacy implementation kept for reference
function _extractGlassTypeOld(text) {
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
// Use shared extractor for location
const extractLocation = sharedExtractors.extractLocation;

// Legacy implementation kept for reference
function _extractLocationOld(text) {
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
// Use shared extractor for features
const extractFeatures = sharedExtractors.extractFeatures;

// Legacy implementation kept for reference
function _extractFeaturesOld(text) {
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
    operation_type: null,
    glass_type: null,
    features: [],
    quantity: 1,
    has_interior_color: false,
    has_exterior_color: false,
    shaped_details: null,
    bay_details: null
  };
  
  // Combine all message content into a single string for analysis
  const fullText = messages
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content)
    .join(' ');
  
  // Extract dimensions with unit conversion
  const dimensions = extractDimensions(fullText);
  if (dimensions) {
    specs.width = dimensions.width;
    specs.height = dimensions.height;
    
    // Convert dimensions if necessary (already handled in messageParser)
    // Implementation would go here if needed
  }
  
  // Extract operation type
  specs.operation_type = extractOperationType(fullText) || 'Hung'; // Default to Hung
  
  // Extract other basic specifications
  specs.window_type = extractWindowType(fullText);
  specs.glass_type = extractGlassType(fullText);
  specs.location = extractLocation(fullText);
  specs.features = extractFeatures(fullText);
  
  // Extract shaped window details if applicable
  if (specs.window_type === 'Shaped') {
    specs.shaped_details = extractShapedWindowDetails(fullText);
  }
  
  // Extract bay window details if applicable
  if (specs.window_type === 'Bay') {
    specs.bay_details = extractBayWindowDetails(fullText);
  }
  
  // Extract color options - using regex patterns directly here for simplicity
  const lowerText = fullText.toLowerCase();
  
  // Check for non-white interior color
  if (
    /interior(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i.test(lowerText) ||
    /inside(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i.test(lowerText) ||
    /(?!white)[a-z]+\s+(?:color|finish)\s+(?:on\s+the\s+)?(?:interior|inside)/i.test(lowerText)
  ) {
    specs.has_interior_color = true;
  }
  
  // Check for non-white exterior color
  if (
    /exterior(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i.test(lowerText) ||
    /outside(?:\s+color|\s+finish)?\s+(?:in\s+|is\s+|should\s+be\s+)?(?!white)[a-z]+/i.test(lowerText) ||
    /(?!white)[a-z]+\s+(?:color|finish)\s+(?:on\s+the\s+)?(?:exterior|outside)/i.test(lowerText)
  ) {
    specs.has_exterior_color = true;
  }
  
  // Extract quantity
  const quantityPatterns = [
    /(\d+)\s+windows?/i,
    /need\s+(\d+)/i,
    /want\s+(\d+)/i,
    /(\d+)\s+(?:of\s+)?(?:these|them)/i
  ];
  
  for (const pattern of quantityPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const quantity = parseInt(match[1], 10);
      if (quantity > 0 && quantity < 100) { // Reasonable range
        specs.quantity = quantity;
        break;
      }
    }
  }
  
  // Check if we have enough data to consider this a complete specification
  const isComplete = specs.width && specs.height && 
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

/**
 * Extract specifications for explicitly numbered windows
 * @param {Array} messages - Array of user messages
 * @returns {Array} - Extracted window specifications for numbered windows
 */
function extractNumberedWindows(messages) {
  const windows = [];
  const userMessages = messages.filter(msg => msg.role === 'user');
  const allText = userMessages.map(msg => msg.content).join(' ');
  
  // Look for patterns like "Window 1: 36x48 inches", "First window", etc.
  const windowPatterns = [
    /(?:window|item)\s*[#:]?\s*(\d+)/gi,
    /(\d+)(?:st|nd|rd|th)\s*window/gi,
    /(?:first|second|third|fourth|fifth)\s*window/gi
  ];
  
  let hasNumberedWindows = false;
  
  for (const pattern of windowPatterns) {
    if (pattern.test(allText)) {
      hasNumberedWindows = true;
      break;
    }
  }
  
  if (!hasNumberedWindows) {
    return [];
  }
  
  // Extract window specifications for each message that contains a window number
  for (const message of userMessages) {
    const content = message.content;
    
    // Check for different numbering patterns
    for (const pattern of windowPatterns) {
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        // Extract the window number
        let windowNumber;
        
        if (/(?:first|second|third|fourth|fifth)/i.test(match[0])) {
          // Convert text numbers to digits
          const textToNumber = {
            'first': 1,
            'second': 2,
            'third': 3,
            'fourth': 4,
            'fifth': 5
          };
          
          for (const [text, number] of Object.entries(textToNumber)) {
            if (match[0].toLowerCase().includes(text)) {
              windowNumber = number;
              break;
            }
          }
        } else {
          // Extract numeric window number
          windowNumber = parseInt(match[1], 10);
        }
        
        if (!windowNumber || isNaN(windowNumber)) continue;
        
        // Create a synthetic message with just this window's information
        // Find the start index of the window mention
        const startIndex = match.index;
        
        // Look for the next window mention or end of message
        let endIndex = content.length;
        for (const otherPattern of windowPatterns) {
          const otherMatches = [...content.matchAll(otherPattern)];
          
          for (const otherMatch of otherMatches) {
            if (otherMatch.index > startIndex && otherMatch.index < endIndex) {
              endIndex = otherMatch.index;
            }
          }
        }
        
        // Extract the text for this window
        const windowText = content.substring(startIndex, endIndex);
        
        // Parse specifications from this text
        const windowSpecs = parseWindowSpecifications([{ role: 'user', content: windowText }]);
        
        // Only add if we could extract dimensions
        if (windowSpecs.width && windowSpecs.height) {
          windowSpecs.window_number = windowNumber;
          windows.push(windowSpecs);
        }
      }
    }
  }
  
  // Sort windows by number
  windows.sort((a, b) => a.window_number - b.window_number);
  
  return windows;
}

/**
 * Group messages by location to identify different windows
 * @param {Array} messages - Array of user messages
 * @returns {Array} - Array of message groups, each potentially about a different window
 */
function groupMessagesByLocation(messages) {
  // Filter to just user messages
  const userMessages = messages.filter(msg => msg.role === 'user');
  
  // Map to track messages by location
  const locationGroups = new Map();
  
  // First pass: group messages by explicitly mentioned locations
  for (const message of userMessages) {
    const location = extractLocation(message.content);
    
    if (location) {
      if (!locationGroups.has(location)) {
        locationGroups.set(location, []);
      }
      locationGroups.get(location).push(message);
    }
  }
  
  // Handle messages without explicit locations
  const unassignedMessages = userMessages.filter(msg => !extractLocation(msg.content));
  
  // Second pass: try to assign messages to existing groups based on context
  for (const message of unassignedMessages) {
    let assigned = false;
    
    // Try to find a group where this message provides missing information
    for (const [location, group] of locationGroups.entries()) {
      // Check if this message adds new information to the group
      const currentSpecs = parseWindowSpecifications(group);
      const combinedSpecs = parseWindowSpecifications([...group, message]);
      
      // If combining with this group adds new information, assign it
      if (
        (!currentSpecs.width && combinedSpecs.width) ||
        (!currentSpecs.height && combinedSpecs.height) ||
        (!currentSpecs.window_type && combinedSpecs.window_type) ||
        (!currentSpecs.glass_type && combinedSpecs.glass_type)
      ) {
        group.push(message);
        assigned = true;
        break;
      }
    }
    
    // If couldn't assign to existing groups, create a new group for coherent message clusters
    if (!assigned) {
      // Check if message contains partial window specifications
      const specs = parseWindowSpecifications([message]);
      
      if (specs.width || specs.height || specs.window_type || specs.glass_type) {
        const locationKey = `unspecified_${locationGroups.size + 1}`;
        locationGroups.set(locationKey, [message]);
      } else {
        // If no window specs, add to the most recent group or create a new one
        const keys = Array.from(locationGroups.keys());
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          locationGroups.get(lastKey).push(message);
        } else {
          locationGroups.set('unspecified_1', [message]);
        }
      }
    }
  }
  
  // Convert map to array of message groups
  return Array.from(locationGroups.values());
}

/**
 * Parse multiple window specifications from conversation messages
 * @param {Array} messages - Array of conversation messages
 * @returns {Object} - Object containing extracted windows and metadata
 */
function parseMultipleWindowSpecifications(messages) {
  try {
    const windows = [];
    
    // Strategy 1: Look for explicitly numbered windows
    const numberedWindows = extractNumberedWindows(messages);
    if (numberedWindows.length > 0) {
      return {
        windows: numberedWindows,
        count: numberedWindows.length,
        has_multiple_windows: numberedWindows.length > 1,
        is_complete: numberedWindows.every(w => w.is_complete)
      };
    }
    
    // Strategy 2: Group messages by location and extract windows
    const messageGroups = groupMessagesByLocation(messages);
    
    for (const group of messageGroups) {
      const specs = parseWindowSpecifications(group);
      
      // Only add if we have enough information for a quote
      if (specs.width && specs.height) {
        windows.push(specs);
      }
    }
    
    // If we found multiple windows, return them
    if (windows.length > 0) {
      return {
        windows,
        count: windows.length,
        has_multiple_windows: windows.length > 1,
        is_complete: windows.every(w => w.is_complete)
      };
    }
    
    // Strategy 3: Fall back to treating the entire conversation as one window
    const singleWindowSpecs = parseWindowSpecifications(messages);
    
    if (singleWindowSpecs.width && singleWindowSpecs.height) {
      return {
        windows: [singleWindowSpecs],
        count: 1,
        has_multiple_windows: false,
        is_complete: singleWindowSpecs.is_complete
      };
    }
    
    // Return empty result if no windows could be extracted
    return {
      windows: [],
      count: 0,
      has_multiple_windows: false,
      is_complete: false
    };
  } catch (error) {
    logger.error('Error extracting multiple windows from conversation:', error);
    return {
      windows: [],
      count: 0,
      has_multiple_windows: false,
      is_complete: false,
      error: error.message
    };
  }
}

module.exports = {
  parseWindowSpecifications,
  parseMultipleWindowSpecifications,
  extractDimensions,
  extractWindowType,
  extractGlassType,
  extractLocation,
  extractFeatures,
  extractOperationType,
  extractShapedWindowDetails,
  extractBayWindowDetails,
  extractNumberedWindows,
  groupMessagesByLocation
};