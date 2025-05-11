const { Anthropic } = require('@anthropic-ai/sdk');
const config = require('../config/config');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
    });
  }

  async generateResponse(prompt, conversationContext = []) {
    try {
      console.log('Generating Claude response for:', prompt);
      console.log('Using conversation context:', JSON.stringify(conversationContext.slice(-2)));
    
      // Log your Claude API key format (don't log the full key)
      console.log('API key present:', !!config.claude.apiKey);
      console.log('API key format check:', config.claude.apiKey?.substring(0, 5) + '...');
      
      // Prepare the content for the Claude API
      const systemPrompt = `You are a helpful window quote assistant for a window installation company. 
      Your goal is to gather information to provide a rough quote for window installation.
      
      Follow these guidelines:
      1. Be friendly and professional
      2. Ask for window dimensions (width x height in inches)
      3. Ask for window type (Standard, Bay, or Shaped)
      4. Ask if they want single, double, or triple pane
      5. Ask if they want any special features (grilles, low-E glass, etc.)
      6. Calculate a rough estimate based on the information provided
      7. Always encourage them to schedule an in-person measurement for an exact quote
      8. Keep responses concise and appropriate for WhatsApp
      
      Basic pricing guidelines:
      - Standard windows: $40-50 per square foot for basic configuration
      - Bay windows: 25% more than standard windows
      - Triple pane: Additional $11 per square foot over double pane
      - Low-E glass with argon: Additional $125 per window
      - Grilles: Additional $5 per square foot
      
      If the user provides dimensions, calculate the square footage (width × height ÷ 144).`;

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
      console.error('Error generating Claude response:', error.message, error.stack);
      return "I'm sorry, I'm having trouble processing your request right now. Could you try again in a moment?";
    }
  }
}

module.exports = new ClaudeService();