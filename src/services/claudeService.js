const { Anthropic } = require('@anthropic-ai/sdk');
const config = require('../config/config');
const logger = require('../utils/logger');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
    });
    // Retry configuration from environment variables
    this.maxRetries = config.claude.retries.maxAttempts;
    this.baseDelayMs = config.claude.retries.baseDelayMs;
    this.maxDelayMs = config.claude.retries.maxDelayMs;
  }

  /**
   * Sleep for a specified number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   * @param {number} retryCount - Current retry attempt
   * @returns {number} - Delay in milliseconds
   */
  getBackoffDelay(retryCount) {
    return Math.min(
      this.baseDelayMs * Math.pow(2, retryCount) + Math.random() * 100,
      this.maxDelayMs
    );
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether this error should be retried
   */
  isRetryableError(error) {
    // Retry on network errors, rate limits, and 5xx server errors
    if (!error.status) return true; // Network errors don't have status
    
    // Don't retry authentication errors
    if (error.status === 401 || error.status === 403) return false;
    
    // Retry on rate limits
    if (error.status === 429) return true;
    
    // Retry on server errors
    if (error.status >= 500 && error.status < 600) return true;
    
    return false;
  }

  /**
   * Get appropriate fallback message based on error type
   * @param {Error} error - The error that occurred
   * @param {number} retries - How many retries were attempted
   * @returns {string} - User-friendly fallback message
   */
  getFallbackMessage(error, retries) {
    // If we've tried multiple times and still failed, apologize more sincerely
    if (retries >= this.maxRetries) {
      return "I'm very sorry, but I'm experiencing technical difficulties right now. Our team has been notified. Would you mind trying again in a few minutes?";
    }
    
    // Authentication errors
    if (error.status === 401 || error.status === 403) {
      console.error('CRITICAL: Authentication error with Claude API. Check API key configuration.');
      return "I apologize, but I'm unable to access my knowledge resources at the moment. Our support team has been notified of this issue.";
    }
    
    // Rate limiting errors
    if (error.status === 429) {
      return "I'm currently handling many requests. Could you please try again in a moment?";
    }
    
    // Generic error fallback
    return "I'm sorry, I'm having trouble processing your request right now. Could you try again in a moment?";
  }

  async generateResponse(prompt, conversationContext = [], userInfo = {}) {
    let retries = 0;
    let lastError = null;
    const startTime = Date.now();
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

    // Extract relevant user information for logging
    const phone = userInfo.phone || 'unknown';
    const name = userInfo.name || 'unknown';

    // Log request details
    logger.info('Generating Claude response', {
      requestId,
      phone,
      prompt_length: prompt.length,
      context_messages: conversationContext.length
    });

    // Check if there are any system messages in the context (like window specifications)
    const systemMessages = conversationContext.filter(msg => msg.role === 'system');

    logger.debug('Request details', {
      requestId,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      context_length: conversationContext.length,
      system_messages_count: systemMessages.length,
      system_messages: systemMessages.map(msg => msg.content),
      recent_context: JSON.stringify(conversationContext.slice(-2))
    });

    // Log Claude API request
    logger.logClaude({
      type: 'request',
      requestId,
      user: phone,
      user_name: name,
      timestamp: new Date().toISOString(),
      query: prompt,
      context_length: conversationContext.length,
      summary: `Request from ${name}: ${prompt.substring(0, 30)}...`
    });

    // Log your Claude API key format (don't log the full key)
    logger.debug('API key validation', {
      has_key: !!config.claude.apiKey,
      key_format: config.claude.apiKey?.substring(0, 5) + '...'
    });

    // Prepare the content for the Claude API
    const systemPrompt = `You are Bob, a helpful window quote assistant for Nuvo Windows and Doors.
      Your goal is to gather information from customers through WhatsApp to provide accurate window installation price quotes.

      ## CONVERSATION APPROACH
      1. Be friendly, professional, and concise (keep responses under 150 words)
      2. ALWAYS ASSUME customers need a quote - proactively start gathering information
      3. First message should welcome them and immediately begin the quote process
      4. Only ask for ONE piece of missing information at a time
      5. Acknowledge information as customers provide it
      6. Be conversational but efficient - WhatsApp users expect quick exchanges

      ## REQUIRED INFORMATION TO GATHER
      Your primary job is to extract these details from the conversation:
      - Window dimensions (width × height in inches)
      - Window type (Standard, Bay, or Shaped)
      - Glass type (Double or Triple pane) - Note: We do NOT offer single pane
      - Special features (Grilles and/or Low-E glass with argon)
      - Window location in the home (e.g., kitchen, bedroom, living room)
      
      ## SHAPED WINDOWS - IMPORTANT
      For shaped windows (those with arched or custom tops):
      - Ask for the rectangular portion dimensions ONLY (width × height in inches)
      - The height should be measured to where the arch begins, NOT including the arch
      - The arch price is automatically calculated based on the window width
      - Clarify: "Please measure the rectangular part only, not including the arch"

      ## INFORMATION GATHERING SEQUENCE
      1. Start by asking about window location in the home
      2. Next, ask for dimensions (width × height in inches)
      3. Ask about window type
      4. Ask about glass type
      5. Finally, ask about special features

      ## HANDLING RETURNING USERS
      - If you see "Previous window specifications:" in the system message, the customer is returning with existing specs
      - Greet returning customers warmly and reference them by name
      - Acknowledge their previous specifications naturally: "I see you were previously interested in a kitchen window..."
      - Ask if they want to continue with previous specifications or start a new quote
      - Don't repeat questions for information they've already provided
      - Use phrases like "based on your previous specifications" or "from our last conversation"

      ## HANDLING MULTIPLE WINDOWS
      - A single customer may have multiple window specifications saved in our system
      - When multiple windows appear in "Previous window specifications:", acknowledge each one briefly
      - Ask which window they want to focus on first: "I see you have specifications for a kitchen window and a bedroom window. Which would you like to discuss today?"
      - Keep track of which window is currently being discussed
      - When switching between windows, confirm the transition: "Now let's talk about your bedroom window..."
      - After completing one window quote, ask if they want to:
        1. Modify another existing window specification
        2. Add a completely new window specification
        3. Finalize their current quotes
      - Clearly label which window you're discussing in your responses

      ## YOUR ROLE IN QUOTE PROCESS
      1. Focus on extracting clear information through natural conversation
      2. Do NOT calculate quotes yourself - our system will generate the actual quote based on the information you gather
      3. When the customer provides all needed information, acknowledge it and inform them you'll provide a quote
      4. After a quote is generated, explain what it includes and next steps
      5. Always recommend an in-person measurement for the final exact quote

      ## CUSTOMER EDUCATION
      If customers ask about pricing factors, explain:
      - Window pricing is primarily based on size, operation type, and glass options
      - Operation types include: Fixed, Hung, Slider, Casement, and Awning
      - Pricing is based on square footage with specific prices for each operation type
      - Shaped windows are priced as the rectangular section (based on dimensions) plus an arch surcharge (based on width only)
      - Bay windows include additional costs for header/footer and optional exterior siding
      - Triple pane glass costs more than double pane (about $11 per sq ft additional)
      - Optional features like Low-E glass with argon ($110 per window) or grilles ($5 per sq ft) increase the price
      - Specialty glass options include frosted glass ($4 per sq ft) and tinted glass ($5 per sq ft)
      - Installation is calculated at $15 per square foot with a $150 minimum
      - Multiple window discounts are available (2-20% based on quantity)

      ## SPECIAL INTERACTION GUIDELINES
      - When dimensions are unclear: Ask for specific measurements in width × height format in inches
      - When information is incomplete: Focus questions on the missing details
      - When customers have concerns: Emphasize quality, energy efficiency, and warranty
      - When customers are ready to proceed: Offer to schedule an in-person measurement
      - When switching between multiple windows: Clearly indicate which window you're discussing

      ## CONVERSATION EXAMPLES

      # New Customer Example
      Customer: "Hi"
      Bob: "Welcome to Nuvo Windows and Doors! I'm Bob, your quote assistant. I'll help you get a price estimate for your window replacement. To get started, which room is the window for?"

      Customer: "Kitchen"
      Bob: "Great! Could you please provide the dimensions of that kitchen window? I'll need the width and height in inches."

      Customer: "It's 36 inches wide and 48 inches tall."
      Bob: "Thanks for those dimensions. What type of window are you interested in - standard, bay, or shaped?"

      # Returning Customer (Single Window) Example
      Customer: "Hi"
      Bob: "Welcome back to Nuvo Windows and Doors! I see you were previously interested in a 36×48 inches standard window for your kitchen with double pane glass. Would you like to continue with that quote or are you interested in a different window today?"

      Customer: "I want to change to a bay window"
      Bob: "Thanks for letting me know. I'll update your quote for the kitchen window. You still want the 36×48 inch dimensions, but with a bay window style instead of standard. Would you like to keep the double pane glass option?"

      # Returning Customer (Multiple Windows) Example
      Customer: "Hi"
      Bob: "Welcome back to Nuvo Windows and Doors! I see you have specifications for several windows: a 36×48 inches kitchen window, a 30×40 inches bedroom window, and a 24×60 inches living room window. Which window would you like to discuss today?"

      Customer: "The living room one"
      Bob: "Great! For your living room window, I have the dimensions as 24×60 inches with standard type and double pane glass. Would you like to modify any of these specifications or get a quote based on these details?"

      Customer: "I'd like to change it to triple pane"
      Bob: "Perfect! I'll update your living room window to have triple pane glass instead of double pane. The dimensions remain 24×60 inches with a standard window type. Is there anything else you'd like to change about this window?"

      Remember to always be proactive in guiding the conversation toward getting all the information needed for a quote. Don't wait for customers to specifically ask for pricing.`;

    // Implement retry logic with exponential backoff
    while (retries <= this.maxRetries) {
      try {
        // If this is a retry, log it
        if (retries > 0) {
          logger.warn(`Claude API retry attempt ${retries}/${this.maxRetries}`, {
            requestId,
            retry_count: retries,
            max_retries: this.maxRetries
          });
        }

        const apiStartTime = Date.now();
        // Extract system messages from context
        const systemMessages = conversationContext.filter(msg => msg.role === 'system');

        // Get non-system messages
        const regularMessages = conversationContext.filter(msg => msg.role !== 'system');

        // Create system prompt that includes both our standard instructions and any context system messages
        let enhancedSystemPrompt = systemPrompt;
        if (systemMessages.length > 0) {
          // Add window specifications from conversation context to the system prompt
          enhancedSystemPrompt = systemMessages.map(msg => msg.content).join('\n\n') + '\n\n' + systemPrompt;
          logger.debug('Enhanced system prompt with context', {
            requestId,
            added_content: systemMessages.map(msg => msg.content).join('\n\n')
          });
        }

        const response = await this.client.messages.create({
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
        const apiEndTime = Date.now();
        const responseTime = apiEndTime - apiStartTime;

        // Extract token usage from response if available
        const tokenUsage = {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
          total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        };

        // Log response time and token usage
        logger.info('Claude response received', {
          requestId,
          response_time_ms: responseTime,
          tokens: tokenUsage
        });

        // Log full Claude response details
        logger.logClaude({
          type: 'response',
          requestId,
          user: phone,
          timestamp: new Date().toISOString(),
          response_time_ms: responseTime,
          token_usage: tokenUsage,
          model: "claude-3-haiku-20240307",
          response_text: response.content[0].text,
          summary: response.content[0].text.substring(0, 50) + '...'
        });

        return response.content[0].text;
      } catch (error) {
        lastError = error;

        // Log error with structured information
        logger.error(`Claude API error (attempt ${retries + 1}/${this.maxRetries + 1})`, {
          requestId,
          error_message: error.message,
          error_type: error.type || 'unknown',
          error_status: error.status || 'unknown',
          retry_count: retries,
          max_retries: this.maxRetries
        });

        // Log Claude error with full details
        logger.logClaude({
          type: 'error',
          requestId,
          user: phone,
          timestamp: new Date().toISOString(),
          error_message: error.message,
          error_type: error.type || 'unknown',
          error_status: error.status || 'unknown',
          retry_count: retries,
          max_retries: this.maxRetries,
          query: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
          summary: `Error: ${error.message}`
        });

        // Determine if this error is worth retrying
        if (!this.isRetryableError(error) || retries >= this.maxRetries) {
          break;
        }

        // Calculate delay using exponential backoff
        const delayMs = this.getBackoffDelay(retries);
        logger.info(`Retrying in ${delayMs}ms...`, { requestId, delay_ms: delayMs });

        // Wait before retrying
        await this.sleep(delayMs);

        // Increment retry counter
        retries++;
      }
    }

    // If we get here, all retries failed or error wasn't retryable
    const totalTime = Date.now() - startTime;

    logger.error('All Claude API retries failed or error not retryable', {
      requestId,
      total_time_ms: totalTime,
      error_message: lastError.message,
      error_stack: lastError.stack,
      retries_attempted: retries
    });

    // Log the final failure
    logger.logClaude({
      type: 'final_failure',
      requestId,
      user: phone,
      timestamp: new Date().toISOString(),
      total_time_ms: totalTime,
      error_message: lastError.message,
      retries_attempted: retries,
      summary: `Failed after ${retries} retries: ${lastError.message}`
    });

    return this.getFallbackMessage(lastError, retries);
  }
}

module.exports = new ClaudeService();