/**
 * ClarificationService
 * 
 * Handles clarification requests and responses for ambiguous user input.
 * Works with AmbiguityDetector to provide intelligent clarification flows
 * and integrates with ConversationManager to track clarification state.
 */

const AmbiguityDetector = require('../utils/ambiguityDetector');
const logger = require('../utils/logger');

class ClarificationService {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
    this.ambiguityDetector = new AmbiguityDetector();
  }
  
  /**
   * Generate a clarification request for detected ambiguities
   * @param {Array} ambiguities - Array of detected ambiguities
   * @param {Object} currentSpecs - Current window specifications
   * @returns {Object|null} - Clarification request object or null if no clarification needed
   */
  generateClarificationRequest(ambiguities, currentSpecs = {}) {
    if (!ambiguities || ambiguities.length === 0) {
      return null;
    }
    
    try {
      // Prioritize ambiguities by importance and confidence
      const prioritizedAmbiguity = this.prioritizeAmbiguities(ambiguities);
      
      if (!prioritizedAmbiguity) {
        return null;
      }
      
      // Generate context-aware clarification message
      const clarificationMessage = this.generateContextualClarification(
        prioritizedAmbiguity, 
        currentSpecs
      );
      
      return {
        type: 'CLARIFICATION_REQUEST',
        ambiguity: prioritizedAmbiguity,
        message: clarificationMessage,
        expectingClarification: true,
        clarificationId: this.generateClarificationId(prioritizedAmbiguity)
      };
      
    } catch (error) {
      logger.logError(error, {
        operation: 'GENERATE_CLARIFICATION_REQUEST',
        ambiguityCount: ambiguities.length
      });
      
      return null;
    }
  }
  
  /**
   * Process user's clarification response
   * @param {string} userId - User identifier
   * @param {string} userResponse - User's clarification response
   * @param {Object} pendingAmbiguity - The ambiguity awaiting clarification
   * @param {Object} currentSpecs - Current window specifications
   * @returns {Object} - Processing result
   */
  async processUserClarification(userId, userResponse, pendingAmbiguity, currentSpecs = {}) {
    try {
      // Attempt to resolve the ambiguity
      const resolved = this.ambiguityDetector.resolveAmbiguity(pendingAmbiguity, userResponse);
      
      if (resolved) {
        // Merge resolved specs with current specs
        const updatedSpecs = { ...currentSpecs, ...resolved };
        
        // Save updated specs
        await this.conversationManager.savePartialSpecification(userId, updatedSpecs);
        
        // Clear the pending clarification
        await this.clearPendingClarification(userId);
        
        // Log successful resolution
        logger.info('Successfully resolved ambiguity', {
          userId,
          ambiguityType: pendingAmbiguity.type,
          originalTerm: pendingAmbiguity.term,
          resolvedTo: Object.keys(resolved).join(', ')
        });
        
        return {
          resolved: true,
          updatedSpecs: updatedSpecs,
          resolvedFields: Object.keys(resolved),
          message: this.generateResolutionConfirmation(pendingAmbiguity, resolved)
        };
      } else {
        // Ambiguity not resolved, try alternative approaches
        return await this.handleUnresolvedClarification(
          userId, 
          userResponse, 
          pendingAmbiguity, 
          currentSpecs
        );
      }
      
    } catch (error) {
      logger.logError(error, {
        operation: 'PROCESS_USER_CLARIFICATION',
        userId,
        ambiguityType: pendingAmbiguity.type
      });
      
      return {
        resolved: false,
        error: true,
        message: "I'm having trouble understanding your response. Could you please try again?"
      };
    }
  }
  
  /**
   * Handle cases where clarification couldn't be resolved
   * @param {string} userId - User identifier
   * @param {string} userResponse - User's response
   * @param {Object} pendingAmbiguity - The ambiguity that couldn't be resolved
   * @param {Object} currentSpecs - Current specifications
   * @returns {Object} - Handling result
   */
  async handleUnresolvedClarification(userId, userResponse, pendingAmbiguity, currentSpecs) {
    // Check if user is asking for help or more information
    const lowerResponse = userResponse.toLowerCase();
    
    if (lowerResponse.includes('help') || 
        lowerResponse.includes('explain') ||
        lowerResponse.includes('what') ||
        lowerResponse.includes('options')) {
      
      return {
        resolved: false,
        needsHelp: true,
        message: this.generateHelpMessage(pendingAmbiguity)
      };
    }
    
    // Check if user wants to skip this specification
    if (lowerResponse.includes('skip') || 
        lowerResponse.includes('later') ||
        lowerResponse.includes('don\'t know') ||
        lowerResponse.includes('not sure')) {
      
      // Clear the pending clarification and continue
      await this.clearPendingClarification(userId);
      
      return {
        resolved: true,
        skipped: true,
        updatedSpecs: currentSpecs,
        message: "No problem! We can continue with the other details and come back to this later if needed."
      };
    }
    
    // Try to extract any useful information from the response
    const extractedInfo = this.tryExtractInformation(userResponse, pendingAmbiguity);
    
    if (extractedInfo) {
      const updatedSpecs = { ...currentSpecs, ...extractedInfo };
      await this.conversationManager.savePartialSpecification(userId, updatedSpecs);
      await this.clearPendingClarification(userId);
      
      return {
        resolved: true,
        partial: true,
        updatedSpecs: updatedSpecs,
        message: "Got it! I've noted that information."
      };
    }
    
    // Last resort - ask again with simpler language
    return {
      resolved: false,
      retry: true,
      message: this.generateSimplifiedClarification(pendingAmbiguity)
    };
  }
  
  /**
   * Prioritize ambiguities based on importance and confidence
   * @param {Array} ambiguities - Array of ambiguities
   * @returns {Object|null} - Highest priority ambiguity
   */
  prioritizeAmbiguities(ambiguities) {
    if (!ambiguities || ambiguities.length === 0) {
      return null;
    }
    
    // Filter out invalid ambiguities
    const validAmbiguities = ambiguities.filter(a => 
      a && 
      typeof a === 'object' && 
      a.type && 
      a.clarifyMessage
    );
    
    if (validAmbiguities.length === 0) {
      return null;
    }
    
    // Define priority order (lower number = higher priority)
    const typePriority = {
      'operation': 1,  // Most important for functionality
      'size': 2,       // Critical for quotes
      'glass': 3,      // Important for energy efficiency
      'frame': 4       // Least critical
    };
    
    // Sort by type priority first, then by confidence
    const prioritized = validAmbiguities.sort((a, b) => {
      const aPriority = typePriority[a.type] || 5;
      const bPriority = typePriority[b.type] || 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Same priority, sort by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    });
    
    return prioritized[0];
  }
  
  /**
   * Generate contextual clarification message
   * @param {Object} ambiguity - The ambiguity to clarify
   * @param {Object} currentSpecs - Current specifications
   * @returns {string} - Clarification message
   */
  generateContextualClarification(ambiguity, currentSpecs) {
    // Add context based on what we already know
    let contextPrefix = "";
    
    if (currentSpecs.width && currentSpecs.height) {
      contextPrefix = `For your ${currentSpecs.width}x${currentSpecs.height} inch window, `;
    } else if (Object.keys(currentSpecs).length > 0) {
      contextPrefix = "For your window, ";
    }
    
    // Combine context with the clarification message
    return contextPrefix + ambiguity.clarifyMessage;
  }
  
  /**
   * Generate help message for an ambiguity
   * @param {Object} ambiguity - The ambiguity needing help
   * @returns {string} - Help message
   */
  generateHelpMessage(ambiguity) {
    switch (ambiguity.type) {
      case 'size':
        return `I need the exact dimensions of your window in inches. You can measure from the inside frame, width first, then height. For example: "36 inches wide by 48 inches tall" or "36x48".`;
        
      case 'operation':
        return `I need to know how your window opens:\n• Fixed - doesn't open\n• Hung - slides up and down\n• Slider - slides left and right\n• Casement - cranks outward\n• Awning - hinges at top, opens outward`;
        
      case 'glass':
        return `For glass options:\n• Single pane - basic, less insulation\n• Double pane - standard insulation\n• Triple pane - best insulation\n• Low-E coating - reflects heat for energy efficiency\n• Argon gas - better insulation between panes`;
        
      case 'frame':
        return `Frame material options:\n• Vinyl - maintenance-free, affordable\n• Wood - traditional, paintable\n• Aluminum - durable, slim profile\n• Fiberglass - premium, very durable`;
        
      default:
        return "I can help explain the options. What would you like to know more about?";
    }
  }
  
  /**
   * Generate simplified clarification for retry
   * @param {Object} ambiguity - The ambiguity to simplify
   * @returns {string} - Simplified clarification message
   */
  generateSimplifiedClarification(ambiguity) {
    switch (ambiguity.type) {
      case 'size':
        return "What are the width and height of your window in inches?";
        
      case 'operation':
        return "Does your window open? If so, how does it open?";
        
      case 'glass':
        return "Would you like single, double, or triple pane glass?";
        
      case 'frame':
        return "What material would you like for the frame?";
        
      default:
        return `Could you please clarify what you mean by "${ambiguity.term}"?`;
    }
  }
  
  /**
   * Generate confirmation message for resolved ambiguity
   * @param {Object} ambiguity - The resolved ambiguity
   * @param {Object} resolved - The resolved specifications
   * @returns {string} - Confirmation message
   */
  generateResolutionConfirmation(ambiguity, resolved) {
    switch (ambiguity.type) {
      case 'size':
        if (resolved.width && resolved.height) {
          return `Perfect! I've got your window size as ${resolved.width}x${resolved.height} inches.`;
        }
        break;
        
      case 'operation':
        if (resolved.operation_type) {
          return `Great! I've noted that you want a ${resolved.operation_type} window.`;
        }
        break;
        
      case 'glass':
        if (resolved.pane_count) {
          const extras = [];
          if (resolved.has_low_e) extras.push('Low-E coating');
          if (resolved.has_argon) extras.push('argon fill');
          
          const extrasText = extras.length > 0 ? ` with ${extras.join(' and ')}` : '';
          return `Excellent! I've got ${resolved.pane_count}-pane glass${extrasText}.`;
        }
        break;
        
      case 'frame':
        if (resolved.frame_material) {
          return `Perfect! I've noted ${resolved.frame_material} frame material.`;
        }
        break;
    }
    
    return "Got it! I've updated your specifications.";
  }
  
  /**
   * Try to extract any useful information from unclear response
   * @param {string} userResponse - User's response
   * @param {Object} ambiguity - The ambiguity context
   * @returns {Object|null} - Extracted information or null
   */
  tryExtractInformation(userResponse, ambiguity) {
    const lowerResponse = userResponse.toLowerCase();
    
    // Try to extract numbers for size ambiguities
    if (ambiguity.type === 'size') {
      const numbers = userResponse.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        return {
          width: parseInt(numbers[0]),
          height: parseInt(numbers[1])
        };
      }
    }
    
    // Try to extract operation type keywords
    if (ambiguity.type === 'operation') {
      const operationKeywords = ['fixed', 'hung', 'slider', 'casement', 'awning'];
      for (const keyword of operationKeywords) {
        if (lowerResponse.includes(keyword)) {
          return { operation_type: keyword };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Save pending clarification to conversation context
   * @param {string} userId - User identifier
   * @param {Object} ambiguity - The ambiguity awaiting clarification
   */
  async savePendingClarification(userId, ambiguity) {
    try {
      await this.conversationManager.setConversationContext(userId, 'pendingClarification', {
        ambiguity: ambiguity,
        timestamp: new Date().toISOString(),
        clarificationId: this.generateClarificationId(ambiguity)
      });
      
      logger.debug('Saved pending clarification', {
        userId,
        ambiguityType: ambiguity.type,
        term: ambiguity.term
      });
      
    } catch (error) {
      logger.logError(error, {
        operation: 'SAVE_PENDING_CLARIFICATION',
        userId,
        ambiguityType: ambiguity.type
      });
    }
  }
  
  /**
   * Get pending clarification from conversation context
   * @param {string} userId - User identifier
   * @returns {Object|null} - Pending clarification or null
   */
  async getPendingClarification(userId) {
    try {
      const context = await this.conversationManager.getConversationContext(userId, 1);
      
      // Look for system message with pending clarification
      const systemMessage = context.find(msg => 
        msg.role === 'system' && 
        msg.content && 
        msg.content.includes('pendingClarification')
      );
      
      if (systemMessage) {
        // Extract clarification from system message
        // This is a simplified implementation
        return systemMessage.pendingClarification || null;
      }
      
      return null;
      
    } catch (error) {
      logger.logError(error, {
        operation: 'GET_PENDING_CLARIFICATION',
        userId
      });
      
      return null;
    }
  }
  
  /**
   * Clear pending clarification from conversation context
   * @param {string} userId - User identifier
   */
  async clearPendingClarification(userId) {
    try {
      await this.conversationManager.setConversationContext(userId, 'pendingClarification', null);
      
      logger.debug('Cleared pending clarification', { userId });
      
    } catch (error) {
      logger.logError(error, {
        operation: 'CLEAR_PENDING_CLARIFICATION',
        userId
      });
    }
  }
  
  /**
   * Generate a unique ID for a clarification request
   * @param {Object} ambiguity - The ambiguity object
   * @returns {string} - Unique clarification ID
   */
  generateClarificationId(ambiguity) {
    const timestamp = Date.now().toString(36);
    const type = ambiguity.type || 'unknown';
    const term = (ambiguity.term || 'term').replace(/[^a-z0-9]/gi, '');
    
    return `clarify_${type}_${term}_${timestamp}`;
  }
}

module.exports = ClarificationService;