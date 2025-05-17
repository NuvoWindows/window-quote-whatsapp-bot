# Parser Documentation

This document explains the different parsing utilities in the Window Quote WhatsApp Bot and why they are separated into distinct modules.

## Overview

The system uses two distinct parser modules:

1. **messageParser.js** - Real-time text parsing for immediate quote generation
2. **windowSpecParser.js** - Conversation-based parsing for context-aware specification extraction

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

## Future Considerations

1. **Potential Unification**: While the parsers serve different purposes, some shared utilities could be extracted to a common module.

2. **Enhanced Context Awareness**: The windowSpecParser could be enhanced to better understand conversational nuances.

3. **Machine Learning Integration**: Both parsers could benefit from ML models to improve extraction accuracy.

4. **Validation Layer**: A shared validation module could ensure consistency between both parsers' outputs.

## Maintenance Notes

- Keep parsers focused on their specific use cases
- Update regex patterns in both when adding new window types or features
- Test both parsers when adding new specification fields
- Consider the different error handling approaches when making changes