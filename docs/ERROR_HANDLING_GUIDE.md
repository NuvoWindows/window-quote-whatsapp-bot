# Error Handling Guide

**Last Updated:** May 25, 2025  
**Version:** 1.0.0

This guide describes how the Window Quote WhatsApp Bot handles errors and edge cases to provide a seamless user experience.

## Overview

The bot implements a comprehensive error handling system that gracefully handles:
- Missing or incomplete specifications
- Ambiguous user inputs
- API failures and transient errors
- Conversation disruptions
- Complex measurement scenarios

## Error Handling Components

### 1. Conversation Flow Management

The `ConversationFlowService` orchestrates the entire conversation flow:
- Handles returning users with partial specifications
- Manages conversation resumption after interruptions
- Applies sensible defaults for expired conversations (30+ days)
- Saves progress after each user interaction

### 2. Ambiguity Clarification

When users provide ambiguous terms, the system uses:

**AmbiguityDetector**:
- Identifies ambiguous terms in user messages
- Maps common terms to clarification needs
- Assigns confidence scores to ambiguities

**ClarificationService**:
- Generates context-aware clarification questions
- Prioritizes ambiguities by importance
- Tracks pending clarifications
- Processes user responses to resolve ambiguities

Common ambiguous terms handled:
- "standard/regular window" → Clarifies specific operation type
- "normal glass" → Clarifies between clear, tinted, or Low-E options
- "medium size" → Asks for specific dimensions

### 3. Retry Mechanisms

The `RetryUtil` provides centralized retry logic:
- Exponential backoff with jitter to prevent thundering herd
- Configurable max retries and delays
- Context-aware retry decisions
- Integration with error monitoring

Used for:
- Claude API calls
- Database operations
- External service integrations

### 4. Error Context Preservation

The `ErrorContextService` captures comprehensive error information:
- Current conversation phase
- User specifications at time of error
- Recent user messages
- Error type and details

This context enables intelligent recovery strategies.

### 5. Error Recovery Strategies

The `ErrorRecoveryService` implements different recovery strategies based on error type:

**API Failures**:
- Automatic retry with exponential backoff
- Graceful degradation to cached responses
- User-friendly error messages

**Invalid Specifications**:
- Specific guidance on what's wrong
- Examples of correct format
- Option to start over

**Conversation Disruptions**:
- Resume from last known state
- Summarize previous context
- Confirm specifications before continuing

### 6. Error Monitoring and Alerting

The `ErrorMonitoringService` provides:

**Pattern Detection**:
- Frequency-based detection (errors per time window)
- User impact analysis (unique users affected)
- Error chain detection (cascading failures)
- Time correlation (clustered errors)

**Multi-Channel Alerting**:
- Console logging (always active)
- Slack notifications (configurable)
- Email alerts (configurable)
- PagerDuty integration (for critical errors)

**Health Metrics**:
- Service health score (0-100)
- Error rates by category
- Dashboard data for visualization

### 7. Professional Measurement Support

For complex window configurations, the system offers professional measurement services:

**Assessment Criteria**:
- Bay windows or custom shapes
- Multiple windows (5+)
- Historic homes
- Unusual installations

**User Options**:
- Schedule professional measurement
- Provide contact information
- Continue with DIY guidance
- Defer measurements for later

## Error Categories

### 1. Input Errors
- Missing required specifications
- Invalid dimensions
- Ambiguous descriptions

**Handling**: Clarification questions, validation feedback, examples

### 2. System Errors
- API failures
- Database errors
- Service unavailability

**Handling**: Automatic retry, graceful degradation, user notification

### 3. Business Logic Errors
- Invalid window configurations
- Pricing calculation errors
- Quote generation failures

**Handling**: Specific error messages, alternative suggestions, support contact

## Best Practices

### For Developers

1. **Always provide context** when throwing errors:
   ```javascript
   throw new Error(`Invalid window dimensions: ${width}x${height}`);
   ```

2. **Use error categories** for better monitoring:
   ```javascript
   logger.logError(error, {
     category: 'VALIDATION_ERROR',
     userId: userId,
     operation: 'PARSE_DIMENSIONS'
   });
   ```

3. **Implement retryable operations** properly:
   ```javascript
   const result = await retryUtil.executeWithRetry(
     async () => await apiCall(),
     (error) => error.code === 'RATE_LIMIT',
     { maxRetries: 3, context: { operation: 'API_CALL' } }
   );
   ```

### For System Configuration

1. **Configure monitoring thresholds** in environment variables:
   ```
   ERROR_FREQUENCY_THRESHOLD=10
   ERROR_USER_IMPACT_THRESHOLD=5
   ERROR_TIME_WINDOW_MS=300000
   ```

2. **Set up alerting channels**:
   ```
   SLACK_WEBHOOK_URL=your-webhook-url
   ALERT_EMAIL=ops@example.com
   PAGERDUTY_API_KEY=your-api-key
   ```

3. **Enable appropriate log levels**:
   ```
   LOG_LEVEL=info
   LOG_TO_FILE=true
   ```

## Error Response Examples

### Missing Specifications
```
I notice you haven't provided the window dimensions yet. 

To give you an accurate quote, I'll need:
- Width (in inches)
- Height (in inches)

For example: "36 inches wide by 48 inches tall"
```

### Ambiguous Input
```
When you say "standard window", did you mean:
• Casement (opens outward with a crank)
• Double-hung (slides up and down)
• Slider (slides left to right)

Which type would you prefer?
```

### API Failure
```
I'm having a temporary issue generating your quote. I'll try again in a moment...

[After retry fails]
I apologize for the difficulty. Our quote system is temporarily unavailable. 
Your information has been saved. Please try again in a few minutes, or 
text "RESUME" to continue where we left off.
```

### Complex Measurement
```
I notice you're looking for a quote on a bay window configuration. 
These require precise measurements for accurate pricing.

Would you like to:
1. Schedule a free professional measurement
2. Provide your own measurements
3. Get a rough estimate based on standard sizes

Reply with 1, 2, or 3.
```

## Common Deployment Issues and Fixes

### Variable Scope in Error Handlers
**Issue**: Variables like `phone` and `name` undefined in error handlers
**Fix**: Declare variables at function scope, not inside try blocks
```javascript
async handleMessage(req, res) {
  // Declare at function scope
  let phone = 'unknown';
  let name = 'there';
  
  try {
    // ... rest of code
  }
}
```

### Method Parameter Mismatches
**Issue**: Passing incorrect number of parameters to service methods
**Fix**: Check method signatures and ensure correct parameter count
```javascript
// Wrong: 4 parameters
await service.processUserMessage(phone, message, {}, { name });

// Correct: 3 parameters
await service.processUserMessage(phone, message, {});
```

### Express Route Handler Context
**Issue**: `this` context lost when passing class methods as route handlers
**Fix**: Bind methods in constructor
```javascript
constructor() {
  // ... initialize services
  
  // Bind methods to preserve context
  this.handleMessage = this.handleMessage.bind(this);
  this.verifyWebhook = this.verifyWebhook.bind(this);
}
```

## Monitoring and Debugging

### Viewing Error Logs
```bash
# View recent errors
tail -f logs/error.log

# Search for specific error patterns
grep "VALIDATION_ERROR" logs/app.log

# View errors for specific user
grep "userId: user123" logs/app.log
```

### Admin Dashboard
Access error statistics and patterns via the admin API:
```
GET /admin/errors/dashboard
GET /admin/errors/stats
```

### Common Issues and Solutions

1. **High clarification rate**: Review ambiguity detection thresholds
2. **Frequent API timeouts**: Check retry configuration and API rate limits
3. **Quote generation failures**: Verify specification validation logic
4. **Poor error recovery**: Review recovery strategy mappings

## Testing Error Handling

All error handling components have comprehensive test coverage:
- Unit tests for individual error handlers
- Integration tests for error recovery flows
- Mock scenarios for various failure modes

Run tests with:
```bash
npm test -- --testPathPattern="error|clarification|recovery"
```

## Future Improvements

1. **Machine Learning**: Train models to better predict user intent from ambiguous inputs
2. **A/B Testing**: Test different error messages for effectiveness
3. **Auto-Recovery**: Implement more sophisticated automatic recovery strategies
4. **Predictive Monitoring**: Detect potential issues before they affect users