# Parser Documentation

**Last Updated:** May 18, 2025  
**Version:** 2.1.0

This document explains the different parsing utilities in the Window Quote WhatsApp Bot and why they are separated into distinct modules.

## Overview

The system uses two distinct parser modules, a shared extraction library, and a validation module:

1. **messageParser.js** - Real-time text parsing for immediate quote generation
2. **windowSpecParser.js** - Conversation-based parsing for context-aware specification extraction
3. **sharedExtractors.js** - Common extraction logic used by both parsers
4. **windowValidator.js** - Validates extracted specifications (NEW)

## messageParser.js

**Purpose**: Extracts window specifications from individual messages for immediate quote generation.

**Location**: `/src/utils/messageParser.js`

**Primary Use Cases**:
- Direct API requests via `/api/quotes`
- Single message parsing where full conversation context is not needed
- Rapid quote generation from structured messages

**Key Features**:
- Extracts exact dimensions (width x height) from text
- Identifies window types (standard, bay, shaped)
- Parses pane counts
- Identifies options (Low-E, grilles, etc.)
- Returns immediately actionable data

**Example Usage**:
```javascript
// In quoteController.js
const dimensions = messageParser.extractDimensions(message);
const windowType = messageParser.extractWindowType(message) || 'standard';
const paneCount = messageParser.extractPaneCount(message);
const options = messageParser.extractOptions(message);
```

## windowSpecParser.js

**Purpose**: Analyzes entire conversation threads to extract window specifications through context understanding.

**Location**: `/src/utils/windowSpecParser.js`

**Primary Use Cases**:
- WhatsApp conversation analysis
- Conversation context management
- Building specifications from fragmented information across multiple messages
- Quote generation from conversation history

**Key Features**:
- Processes arrays of conversation messages
- Handles context from multiple exchanges
- Tracks specification completeness
- Identifies information spread across messages
- Returns comprehensive specification objects

**Example Usage**:
```javascript
// In conversationManager.js
const specs = windowSpecParser.parseWindowSpecifications(messages);
if (specs.is_complete) {
    await this.saveWindowSpecification(userId, specs);
}
```

## Why Two Parsers?

### 1. Different Input Sources
- **messageParser**: Single strings/messages
- **windowSpecParser**: Arrays of conversation messages

### 2. Different Context Requirements
- **messageParser**: No context needed, immediate parsing
- **windowSpecParser**: Requires conversation history and context awareness

### 3. Different Output Expectations
- **messageParser**: Individual field extraction (dimensions, type, etc.)
- **windowSpecParser**: Complete specification objects with validation

### 4. Different Use Patterns
- **messageParser**: Synchronous, direct API calls
- **windowSpecParser**: Asynchronous, conversation flow analysis

### 5. Different Error Handling
- **messageParser**: Returns null for unparseable fields
- **windowSpecParser**: Tracks completeness and missing fields

## Integration Points

### Quote Controller
Uses `messageParser` for direct quote generation from API messages:
- Direct dimension extraction
- Immediate response requirements
- No conversation context available

### Conversation Manager
Uses `windowSpecParser` for conversation-based processing:
- Analyzes full conversation threads
- Saves specifications to database
- Enhances conversation context

### Context Summarizer
Uses `windowSpecParser` for information extraction:
- Summarizes conversation content
- Identifies important window-related information
- Optimizes token usage for AI context

## Best Practices

### When to Use messageParser
- Direct API endpoints
- Single message processing
- Immediate response requirements
- Structured input expected

### When to Use windowSpecParser
- WhatsApp conversation processing
- Multi-message context analysis
- Database persistence of specifications
- Gradual information gathering

## Shared Extractors

As of May 2025, common extraction logic has been moved to `sharedExtractors.js`:

### Shared Methods
- `extractOperationType()` - Window operation types
- `extractDimensions()` - Width and height extraction with unit conversion
- `extractLocation()` - Room/location information
- `extractWindowType()` - Window type classification
- `extractPaneCount()` - Pane count extraction
- `extractOptions()` - Window options (Low-E, grilles, etc.)
- `extractFeatures()` - Feature array format

### Benefits of Shared Extractors
1. **Eliminated Duplication**: ~60% code reduction
2. **Consistency**: Both parsers use identical extraction logic
3. **Maintainability**: Update patterns in one place
4. **Testing**: Centralized test suite for extraction logic

## Window Validator

The `windowValidator.js` module validates extracted specifications:

### Key Features
- Validates dimension ranges (12" min, 120" max for all window types)
- Provides user-friendly error messages
- Suggests corrections for common mistakes (e.g., swapped dimensions)
- Validates unit conversions
- Logs validation failures for future analysis

### Integration with Message Parser
```javascript
// New method in messageParser.js
extractAndValidateSpecifications(message) {
  const specs = this.extractAllSpecifications(message);
  const validationResult = windowValidator.validateWindowSpecifications(specs);
  specs.validation = validationResult;
  if (!validationResult.isValid) {
    specs.validationMessage = windowValidator.formatValidationMessage(validationResult);
  }
  return specs;
}
```

### Validation Result Structure
```javascript
{
  isValid: boolean,
  errors: string[],      // Critical errors that prevent quote generation
  suggestions: string[], // Helpful suggestions for fixing errors
  warnings: string[]     // Non-critical warnings
}
```

## Future Considerations

1. **Enhanced Context Awareness**: The windowSpecParser could be enhanced to better understand conversational nuances.

2. **Machine Learning Integration**: Both parsers could benefit from ML models to improve extraction accuracy.

3. **Multi-Panel Window Support**: Future enhancement to handle windows with multiple panels and different operation types per panel.

4. **Additional Shared Utilities**: Consider moving more common logic to shared modules.

## Maintenance Notes

- Keep parsers focused on their specific use cases
- Update extraction patterns in `sharedExtractors.js` for consistency
- Test the shared extractors when adding new specification fields
- Consider the different error handling approaches when making changes

## Change Log

### Version 2.1.0 - May 18, 2025
- Added window validator module
- Integrated validation with messageParser
- Updated documentation for validation system

### Version 2.0.0 - May 18, 2025
- Added shared extractors module
- Updated documentation to reflect refactoring
- Eliminated code duplication between parsers

### Version 1.0.0 - Original
- Initial documentation of separate parsers