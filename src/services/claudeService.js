const { Anthropic } = require('@anthropic-ai/sdk');
const config = require('../config/config');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
    });
    // Retry configuration
    this.maxRetries = 3;
    this.baseDelayMs = 300;
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
      3000 // Max 3 seconds
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

  async generateResponse(prompt, conversationContext = []) {
    let retries = 0;
    let lastError = null;

    console.log('Generating Claude response for:', prompt);
    console.log('Using conversation context:', JSON.stringify(conversationContext.slice(-2)));
  
    // Log your Claude API key format (don't log the full key)
    console.log('API key present:', !!config.claude.apiKey);
    console.log('API key format check:', config.claude.apiKey?.substring(0, 5) + '...');
    
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

      ## INFORMATION GATHERING SEQUENCE
      1. Start by asking about window location in the home
      2. Next, ask for dimensions (width × height in inches)
      3. Ask about window type
      4. Ask about glass type
      5. Finally, ask about special features
      
      ## HANDLING MULTIPLE WINDOWS
      - After completing one quote, ask if they need quotes for additional windows
      - If they continue with another quote for the same location, don't ask for location again
      - Track each window separately in the conversation

      ## YOUR ROLE IN QUOTE PROCESS
      1. Focus on extracting clear information through natural conversation
      2. Do NOT calculate quotes yourself - our system will generate the actual quote based on the information you gather
      3. When the customer provides all needed information, acknowledge it and inform them you'll provide a quote
      4. After a quote is generated, explain what it includes and next steps
      5. Always recommend an in-person measurement for the final exact quote

      ## CUSTOMER EDUCATION
      If customers ask about pricing factors, explain:
      - Base price depends on window size, type, and glass options
      - Window type affects price (bay and shaped windows cost more than standard)
      - Triple pane costs more than double pane
      - Optional features like Low-E glass with argon or grilles increase the price
      - Installation is calculated separately based on size

      ## SPECIAL INTERACTION GUIDELINES
      - When dimensions are unclear: Ask for specific measurements in width × height format in inches
      - When information is incomplete: Focus questions on the missing details
      - When customers have concerns: Emphasize quality, energy efficiency, and warranty
      - When customers are ready to proceed: Offer to schedule an in-person measurement

      ## CONVERSATION EXAMPLES
      Customer: "Hi"
      Bob: "Welcome to Nuvo Windows and Doors! I'm Bob, your quote assistant. I'll help you get a price estimate for your window replacement. To get started, which room is the window for?"

      Customer: "Kitchen"
      Bob: "Great! Could you please provide the dimensions of that kitchen window? I'll need the width and height in inches."

      Customer: "It's 36 inches wide and 48 inches tall."
      Bob: "Thanks for those dimensions. What type of window are you interested in - standard, bay, or shaped?"

      Remember to always be proactive in guiding the conversation toward getting all the information needed for a quote. Don't wait for customers to specifically ask for pricing.`;

    // Implement retry logic with exponential backoff
    while (retries <= this.maxRetries) {
      try {
        // If this is a retry, log it
        if (retries > 0) {
          console.log(`Claude API retry attempt ${retries}/${this.maxRetries}`);
        }
        
        const response = await this.client.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationContext.concat([
            {
              role: "user",
              content: prompt
            }
          ])
        });

        console.log('Claude response received:', response.content[0].text.substring(0, 50) + '...');
        return response.content[0].text;
      } catch (error) {
        lastError = error;
        console.error(`Claude API error (attempt ${retries + 1}/${this.maxRetries + 1}):`, error.message);
        
        // Determine if this error is worth retrying
        if (!this.isRetryableError(error) || retries >= this.maxRetries) {
          break;
        }
        
        // Calculate delay using exponential backoff
        const delayMs = this.getBackoffDelay(retries);
        console.log(`Retrying in ${delayMs}ms...`);
        
        // Wait before retrying
        await this.sleep(delayMs);
        
        // Increment retry counter
        retries++;
      }
    }

    // If we get here, all retries failed or error wasn't retryable
    console.error('All Claude API retries failed or error not retryable:', lastError.message, lastError.stack);
    return this.getFallbackMessage(lastError, retries);
  }
}

module.exports = new ClaudeService();