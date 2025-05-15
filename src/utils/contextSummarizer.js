/**
 * Context Summarizer Utility
 * 
 * Provides functions to intelligently summarize conversation context
 * while preserving important information like window specifications.
 */

const logger = require('./logger');
const windowSpecParser = require('./windowSpecParser');
const tokenEstimator = require('./tokenEstimator');

// Constants
const KEY_PHRASES = [
  'window', 'dimension', 'size', 'measurement', 'width', 'height', 
  'inches', 'type', 'glass', 'pane', 'low-e', 'argon', 'grille',
  'bay', 'standard', 'shaped', 'kitchen', 'bedroom', 'living room',
  'quote', 'price', 'cost', 'estimate'
];

/**
 * Determines if a message contains important information
 * @param {Object} message - Message object with role and content
 * @returns {boolean} - True if message contains important information
 */
function isImportantMessage(message) {
  if (!message || !message.content) return false;
  
  const lowerContent = message.content.toLowerCase();
  
  // Check for key phrases related to window specifications
  return KEY_PHRASES.some(phrase => lowerContent.includes(phrase));
}

/**
 * Extracts user information from a set of messages
 * @param {Array} messages - Array of message objects
 * @returns {Object} - Extracted user information
 */
function extractUserInformation(messages) {
  // Filter for user messages
  const userMessages = messages.filter(msg => msg.role === 'user');
  const userContent = userMessages.map(msg => msg.content).join(' ');
  
  // Try to extract window specifications
  const specs = windowSpecParser.parseWindowSpecifications(messages);
  
  // Build user information object
  return {
    mentionedWindowSpecs: specs.is_complete,
    location: specs.location,
    dimensions: specs.width && specs.height ? `${specs.width}×${specs.height}` : null,
    windowType: specs.window_type,
    glassType: specs.glass_type,
    features: specs.features
  };
}

/**
 * Generates a summary of a block of conversation messages
 * @param {Array} messages - Array of message objects to summarize
 * @returns {Object} - Summary message object
 */
function summarizeMessageBlock(messages) {
  if (!messages || messages.length === 0) {
    return null;
  }
  
  // Extract key information from the conversation block
  const userInfo = extractUserInformation(messages);
  
  // Count message types
  const userCount = messages.filter(msg => msg.role === 'user').length;
  const assistantCount = messages.filter(msg => msg.role === 'assistant').length;
  
  // Generate summary
  let summary = `Conversation summary (${userCount} user messages, ${assistantCount} assistant responses): `;
  
  // Add window specification details if available
  if (userInfo.mentionedWindowSpecs) {
    summary += `User provided window specifications for a ${userInfo.location || 'window'} `;
    
    if (userInfo.dimensions) {
      summary += `with dimensions ${userInfo.dimensions} inches, `;
    }
    
    if (userInfo.windowType) {
      summary += `${userInfo.windowType} type, `;
    }
    
    if (userInfo.glassType) {
      summary += `${userInfo.glassType}, `;
    }
    
    if (userInfo.features && userInfo.features.length > 0) {
      summary += `with ${userInfo.features.join(' and ')}, `;
    }
    
    summary = summary.replace(/, $/, '. ');
  } else {
    // Generic summary if no window specifications
    summary += 'General discussion about window options. ';
  }
  
  logger.debug('Generated message block summary', {
    message_count: messages.length,
    summary_length: summary.length,
    has_specs: userInfo.mentionedWindowSpecs
  });
  
  return {
    role: 'system',
    content: summary.trim()
  };
}

/**
 * Optimizes conversation context to fit within token limits
 * while preserving important information
 * 
 * @param {Array} messages - Full array of conversation messages
 * @param {number} maxTokens - Maximum allowed tokens
 * @returns {Array} - Optimized conversation context
 */
function optimizeContext(messages, maxTokens = 7000) {
  if (!messages || messages.length === 0) {
    return [];
  }
  
  // Clone messages to avoid modifying the original
  const allMessages = [...messages];
  
  // Always keep the 10 most recent messages
  const recentMessageCount = Math.min(10, allMessages.length);
  const recentMessages = allMessages.slice(-recentMessageCount);
  
  // If recent messages fit within limit, return them
  const recentTokens = tokenEstimator.estimateConversationTokens(recentMessages);
  if (recentTokens <= maxTokens) {
    return recentMessages;
  }
  
  // Need to summarize older messages
  const olderMessages = allMessages.slice(0, -recentMessageCount);
  
  // Find important messages in the older part of the conversation
  const importantOlderMessages = olderMessages.filter(isImportantMessage);
  
  // If we have room for important messages + recent messages
  const importantTokens = tokenEstimator.estimateConversationTokens(importantOlderMessages);
  
  if (importantTokens + recentTokens <= maxTokens) {
    // We can keep all important messages
    return [...importantOlderMessages, ...recentMessages];
  }
  
  // Need to create a summary instead of keeping individual messages
  const summary = summarizeMessageBlock(olderMessages);
  const summaryTokens = tokenEstimator.estimateMessageTokens(summary);
  
  // If summary + recent messages fit
  if (summaryTokens + recentTokens <= maxTokens) {
    return [summary, ...recentMessages];
  }
  
  // Last resort: only keep as many of the most recent messages as possible
  const fittableCount = Math.floor(maxTokens / (recentTokens / recentMessageCount));
  return recentMessages.slice(-fittableCount);
}

module.exports = {
  optimizeContext,
  summarizeMessageBlock,
  isImportantMessage,
  extractUserInformation
};