/**
 * Token Estimator Utility
 * 
 * Provides functions to estimate token counts for Claude API.
 * Based on simple character ratio approximation.
 */

/**
 * Estimates the number of tokens in a string
 * 
 * This is a rough approximation based on the average tokens per character ratio.
 * Claude uses a tokenizer that breaks text into word fragments, so this won't be exact,
 * but it provides a reasonable estimate to control context size.
 * 
 * @param {string} text - The text to estimate tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokens(text) {
  if (!text) return 0;
  
  // Claude's tokenization is roughly 4 characters per token on average for English text
  const CHARS_PER_TOKEN = 4;
  
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimates tokens for a conversation message object
 * 
 * @param {Object} message - Message object with role and content
 * @returns {number} - Estimated token count
 */
function estimateMessageTokens(message) {
  if (!message || !message.content) return 0;
  
  // Role adds a small overhead
  const roleOverhead = 3;
  
  return estimateTokens(message.content) + roleOverhead;
}

/**
 * Estimates tokens for an array of conversation messages
 * 
 * @param {Array} messages - Array of message objects
 * @returns {number} - Total estimated token count
 */
function estimateConversationTokens(messages) {
  if (!messages || !Array.isArray(messages)) return 0;
  
  // Format overhead for the messages array structure
  const formatOverhead = 10;
  
  // Sum token estimates for all messages
  const messageTokens = messages.reduce((sum, message) => {
    return sum + estimateMessageTokens(message);
  }, 0);
  
  return messageTokens + formatOverhead;
}

module.exports = {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens
};