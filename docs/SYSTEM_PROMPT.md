# Claude System Prompt Design

This document outlines the design principles and structure of the system prompt used for the Claude AI integration in the Window Quote WhatsApp Bot.

## Overview

The system prompt is the critical component that shapes how Claude responds to user messages. It's designed to guide Claude in collecting window specifications in a conversational manner, while maintaining context across conversations and handling multiple windows per user.

## Window Specification Data Model

The system is designed to extract and store the following window specification data points:

| Parameter     | Type        | Description                        | Example Values                 | Required |
|---------------|-------------|------------------------------------|--------------------------------|----------|
| location      | String      | Room/location in the home          | Kitchen, Bedroom, Living Room  | Yes      |
| width         | Number      | Width in inches                    | 36, 48, 60                     | Yes      |
| height        | Number      | Height in inches                   | 24, 36, 72                     | Yes      |
| window_type   | String      | Type of window                     | Standard, Bay, Shaped          | Yes      |
| glass_type    | String      | Type of glass pane                 | Double pane, Triple pane       | Yes      |
| features      | Array       | Special window features            | Grilles, Low-E glass with argon| No       |

### Adding New Parameters

The window specification data model can be extended by:

1. Updating the database schema in `src/utils/database.js`
2. Modifying the window specification parser in `src/utils/windowSpecParser.js`
3. Enhancing the Claude system prompt to gather the new parameters
4. Updating the context enhancement in `src/services/conversationManager.js`

When adding new parameters, follow these steps:

1. Add the new field to the `window_specifications` table
2. Create an extraction function in the window specification parser
3. Update the `parseWindowSpecifications` function to include the new parameter
4. Modify the system prompt to instruct Claude to gather this information
5. Update the context enhancement to include the new parameter in the system message

## Key Features

### Conversational Approach

The prompt establishes a conversational tone using these principles:
- Friendly and professional communication style
- Concise responses (under 150 words)
- Proactive information gathering
- One-question-at-a-time approach
- Acknowledging user input
- Efficient exchanges optimized for WhatsApp

### Information Gathering

The prompt guides Claude to collect specific window information in a structured sequence:
1. Window location in the home
2. Window dimensions (width × height in inches)
3. Window type (Standard, Bay, or Shaped)
4. Glass type (Double or Triple pane)
5. Special features (Grilles and/or Low-E glass with argon)

### Handling Returning Users

A key enhancement to the system prompt is handling returning users with context:
- Detection of returning users through conversation history
- Recognition of "Previous window specifications:" in system messages
- Natural references to previous specifications
- Offering to continue or start new quotes
- Avoiding repetitive questions for information already provided
- Natural transition phrases using previously gathered information

### Multiple Window Handling

The prompt includes specific guidance for managing multiple windows:
- Clear tracking of which window is currently being discussed
- Acknowledgment of each window when multiple exist
- Asking users which window to focus on first
- Clear labeling of windows in responses
- Transitions between window discussions
- Offering options to modify, add, or finalize quotes after completing one window

### Pricing and Education

The prompt provides structured customer education elements:
- Explanation of pricing factors
- Guidance on window type cost differences
- Information on glass options costs
- Details on special features pricing impact
- Installation calculation explanations

## Examples Included

The prompt contains example dialogues to guide Claude's responses:
- New customer initial greeting example
- Location and dimensions gathering examples
- Returning customer with single window example
- Returning customer with multiple windows example

## Technical Implementation

This system prompt is implemented in the Claude service (`src/services/claudeService.js`) and is enhanced with previously extracted window specifications when available:

1. Basic system prompt provides core instructions
2. Window specifications extracted from conversations are stored in the database
3. When a user returns, their specifications are retrieved and prepended to the system prompt
4. For long conversations, intelligent summarization maintains relevant context while managing token limits
5. The enhanced and optimized prompt allows Claude to reference specifications naturally while staying within API constraints

### Code Example

The following is a simplified code example showing how the system prompt is enhanced with window specifications:

```javascript
// In conversationManager.js - Enhancing context with window specifications
async function enhanceContextWithSpecifications(userId, messages) {
  // Get window specifications for this user
  const specs = await getWindowSpecifications(userId);

  if (!specs || specs.length === 0) {
    return messages; // No specs available
  }

  // Create a context summary of specifications
  const specSummary = specs.map(spec => {
    let summary = `${spec.location || 'Window'}: ${spec.width || '?'}×${spec.height || '?'} inches`;
    if (spec.window_type) summary += `, ${spec.window_type} type`;
    if (spec.glass_type) summary += `, ${spec.glass_type}`;
    if (spec.features && spec.features.length > 0) {
      summary += `, with ${spec.features.join(' and ')}`;
    }
    return summary;
  }).join('; ');

  // Add system message at the beginning with specification context
  const enhancedMessages = [
    {
      role: 'system',
      content: `Previous window specifications: ${specSummary}`
    },
    ...messages
  ];

  return enhancedMessages;
}

// In claudeService.js - Incorporating system messages into the prompt
async function generateResponse(prompt, conversationContext = [], userInfo = {}) {
  // Extract system messages from context
  const systemMessages = conversationContext.filter(msg => msg.role === 'system');

  // Get non-system messages
  const regularMessages = conversationContext.filter(msg => msg.role !== 'system');

  // Create system prompt that includes both our standard instructions and any context system messages
  let enhancedSystemPrompt = systemPrompt; // Base system prompt
  if (systemMessages.length > 0) {
    // Add window specifications from conversation context to the system prompt
    enhancedSystemPrompt = systemMessages.map(msg => msg.content).join('\n\n') + '\n\n' + systemPrompt;
  }

  // Call Claude API with enhanced system prompt
  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1000,
    system: enhancedSystemPrompt,
    messages: regularMessages.concat([
      {
        role: "user",
        content: prompt
      }
    ])
  });

  return response.content[0].text;
}
```

This code demonstrates how window specifications are formatted into a readable summary, added as a system message to the conversation context, and then integrated with the base system prompt before sending to the Claude API.

## Window Specifications Context Format

When a user has previous window specifications, they are added to the system prompt in this format:

```
Previous window specifications: Kitchen: 36×48 inches, Standard type, Double pane, with Grilles; 
Living Room: 60×72 inches, Bay type, Triple pane, with Low-E glass and Grilles
```

Each window is separated by a semicolon, and includes location, dimensions, type, glass, and special features.

## Future Enhancements

Potential future enhancements to the window specification data model:

1. **Color Options**: Track window frame color preferences
2. **Material Type**: Window frame material (vinyl, wood, aluminum, etc.)
3. **Energy Efficiency Rating**: ENERGY STAR rating or other efficiency metrics
4. **Installation Preferences**: Special installation requirements
5. **Hardware Options**: Handle styles, locks, or other hardware details
6. **Warranty Options**: Extended warranty selections
7. **Budget Constraints**: Price range or budget limitations

Each of these would require updates to the data model, parser, and system prompt.

## Maintenance Guidelines

When updating the system prompt:

1. **Preserve Structure**: Maintain the sectioned format for readability
2. **Update Examples**: Keep examples relevant and representative
3. **Test Changes**: Validate prompt changes with various conversation scenarios
4. **Be Specific**: Provide explicit instructions rather than relying on implicit understanding
5. **Balance Detail**: Include enough guidance without overwhelming the model with instructions
6. **Update Data Model**: When adding new parameters, ensure all components are updated
7. **Document Changes**: Update the versioning section with your changes

Remember that the system prompt is the primary way to control Claude's behavior in the application, so changes should be carefully reviewed and tested.

## Versioning and Change Log

The system prompt should be versioned to track its evolution over time. Any significant changes to the prompt should be documented in this section.

### Version 1.0.0 (2024-05-13)

Initial version with:
- Basic conversation flow for new users
- Information gathering sequence
- Standard pricing education elements
- Sample conversation examples

### Version 1.1.0 (2024-05-13)

Added functionality for:
- Handling returning users
- Multiple window management
- Window specification references
- Enhanced context handling

### Future Versions

Planned enhancements:
- Further refinements to context summarization
- Additional window specification parameters
- Multi-language support
- Better handling of ambiguous specifications