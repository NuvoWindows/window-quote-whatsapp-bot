/**
 * ConversationFlowService
 * 
 * Manages conversation flow for window quote generation, handling:
 * - Returning users with partial specifications
 * - Conversation resumption after interruptions
 * - Application of defaults for expired conversations
 * - Progress tracking and state management
 */

const SpecificationValidator = require('../utils/specificationValidator');
const QuestionGenerator = require('../utils/questionGenerator');
const ClarificationService = require('./clarificationService');
const AmbiguityDetector = require('../utils/ambiguityDetector');
const ProfessionalMeasurementService = require('./professionalMeasurementService');
const MeasurementDeferralService = require('./measurementDeferralService');
const logger = require('../utils/logger');

class ConversationFlowService {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
    this.specValidator = new SpecificationValidator();
    this.questionGenerator = new QuestionGenerator();
    this.clarificationService = new ClarificationService(conversationManager);
    this.ambiguityDetector = new AmbiguityDetector();
    this.professionalMeasurementService = new ProfessionalMeasurementService();
    this.measurementDeferralService = new MeasurementDeferralService(conversationManager);
    
    // Configuration for conversation expiration
    this.expirationWindow = parseInt(process.env.CONVERSATION_EXPIRATION_DAYS || '30') * 24 * 60 * 60 * 1000; // 30 days default
  }
  
  /**
   * Process a user message and determine the next step in the conversation
   * @param {string} userId - User identifier
   * @param {string} message - User's message
   * @param {Object} extractedSpecs - Specifications extracted from the message
   * @returns {Object} - Next step in the conversation
   */
  async processUserMessage(userId, message, extractedSpecs = {}) {
    try {
      // Check if we're waiting for clarification
      const pendingClarification = await this.clarificationService.getPendingClarification(userId);
      
      if (pendingClarification) {
        // Process the clarification response
        const currentSpecs = await this.getCurrentSpecifications(userId);
        const clarificationResult = await this.clarificationService.processUserClarification(
          userId, 
          message, 
          pendingClarification.ambiguity, 
          currentSpecs
        );
        
        if (clarificationResult.resolved) {
          // Clarification was resolved, continue with the updated specs
          return await this.continueAfterClarification(userId, clarificationResult.updatedSpecs, clarificationResult);
        } else {
          // Clarification not resolved, return the clarification response
          return {
            type: 'CLARIFICATION_RETRY',
            message: clarificationResult.message,
            requiresInput: true,
            clarificationFailed: !clarificationResult.retry
          };
        }
      }
      
      // Get current conversation state
      const currentSpecs = await this.getCurrentSpecifications(userId);
      
      // Check for ambiguities in the new message before processing
      const ambiguities = this.ambiguityDetector.detectAmbiguity(message, currentSpecs);
      
      if (ambiguities.length > 0) {
        // Generate clarification request
        const clarificationRequest = this.clarificationService.generateClarificationRequest(
          ambiguities, 
          currentSpecs
        );
        
        if (clarificationRequest) {
          // Save the pending clarification
          await this.clarificationService.savePendingClarification(
            userId, 
            clarificationRequest.ambiguity
          );
          
          return {
            type: 'NEEDS_CLARIFICATION',
            message: clarificationRequest.message,
            ambiguity: clarificationRequest.ambiguity,
            requiresInput: true
          };
        }
      }
      
      // No clarification needed, process normally
      // Merge extracted specs with current specs
      const mergedSpecs = { ...currentSpecs, ...extractedSpecs };
      
      // Validate the merged specifications
      const validation = this.specValidator.validateSpecifications(mergedSpecs);
      
      // Save progress immediately
      await this.saveProgress(userId, mergedSpecs, validation);
      
      // Determine next step based on validation
      return await this.determineNextStep(userId, mergedSpecs, validation, message);
      
    } catch (error) {
      logger.logError(error, {
        operation: 'PROCESS_USER_MESSAGE',
        userId,
        messagePreview: message.substring(0, 100)
      });
      
      return {
        type: 'ERROR',
        message: "I'm having trouble processing that. Could you please try again?",
        requiresInput: true
      };
    }
  }
  
  /**
   * Handle a returning user who may have partial specifications
   * @param {string} userId - User identifier
   * @returns {Object} - Welcome back message and next steps
   */
  async handleReturningUser(userId) {
    try {
      const currentSpecs = await this.getCurrentSpecifications(userId);
      const lastActivity = await this.conversationManager.getLastActivityTime(userId);
      
      // Check if conversation has expired
      if (this.isConversationExpired(lastActivity)) {
        return await this.handleExpiredConversation(userId, currentSpecs);
      }
      
      // Validate current specifications
      const validation = this.specValidator.validateSpecifications(currentSpecs);
      
      // Generate welcome back message
      const welcomeMessage = this.generateWelcomeBackMessage(validation, currentSpecs);
      
      // Determine next step
      const nextStep = await this.determineNextStep(userId, currentSpecs, validation);
      
      return {
        type: 'WELCOME_BACK',
        message: welcomeMessage,
        nextStep,
        resumedConversation: true
      };
      
    } catch (error) {
      logger.logError(error, {
        operation: 'HANDLE_RETURNING_USER',
        userId
      });
      
      return {
        type: 'ERROR',
        message: "Welcome back! Let's start fresh with your window quote. What type of window are you looking for?",
        requiresInput: true
      };
    }
  }
  
  /**
   * Get current specifications for a user
   * @param {string} userId - User identifier
   * @returns {Object} - Current window specifications
   */
  async getCurrentSpecifications(userId) {
    try {
      const specs = await this.conversationManager.getPartialSpecification(userId);
      return specs || {};
    } catch (error) {
      logger.warn('Failed to get current specifications', {
        userId,
        error: error.message
      });
      return {};
    }
  }
  
  /**
   * Save conversation progress
   * @param {string} userId - User identifier
   * @param {Object} specs - Current specifications
   * @param {Object} validation - Validation results
   */
  async saveProgress(userId, specs, validation) {
    try {
      // Save the specifications
      await this.conversationManager.savePartialSpecification(userId, specs);
      
      // Update activity timestamp
      await this.conversationManager.updateLastActivity(userId);
      
      // Save validation state for quick resumption
      await this.conversationManager.setConversationContext(userId, 'validation_state', {
        canGenerateQuote: validation.canGenerateQuote,
        completionPercentage: validation.completionPercentage,
        missingFields: validation.missing.length,
        timestamp: new Date().toISOString()
      });
      
      logger.info('Saved conversation progress', {
        userId,
        completionPercentage: validation.completionPercentage,
        canGenerateQuote: validation.canGenerateQuote
      });
      
    } catch (error) {
      logger.logError(error, {
        operation: 'SAVE_PROGRESS',
        userId
      });
    }
  }
  
  /**
   * Determine the next step in the conversation
   * @param {string} userId - User identifier
   * @param {Object} specs - Current specifications
   * @param {Object} validation - Validation results
   * @param {string} lastMessage - User's last message (optional)
   * @returns {Object} - Next step information
   */
  async determineNextStep(userId, specs, validation, lastMessage = '') {
    // If specifications are complete and valid, generate quote
    if (validation.isValid) {
      return {
        type: 'GENERATE_QUOTE',
        message: "Perfect! I have all the information needed. Let me generate your window quote.",
        specs: specs,
        requiresInput: false
      };
    }
    
    // If we can generate a quote with defaults, offer that option
    if (validation.canGenerateQuote) {
      const specsWithDefaults = this.specValidator.applyDefaults(specs);
      
      return {
        type: 'OFFER_QUOTE_WITH_DEFAULTS',
        message: this.generateDefaultsOfferMessage(validation, specsWithDefaults),
        specs: specsWithDefaults,
        requiresInput: true,
        options: ['generate_quote', 'provide_more_details']
      };
    }
    
    // Need to collect more information
    const nextField = this.specValidator.getNextMissingField(validation);
    
    if (!nextField) {
      // This shouldn't happen, but handle gracefully
      return {
        type: 'ERROR',
        message: "I'm having trouble determining what information I need. Let's start over. What type of window are you looking for?",
        requiresInput: true
      };
    }
    
    // Check if we need professional measurement for complex scenarios
    if (nextField.field === 'width' || nextField.field === 'height' || nextField.field === 'measurements') {
      const measurementAssessment = await this.assessMeasurementNeeds(userId, specs, nextField);
      if (measurementAssessment) {
        return measurementAssessment;
      }
    }
    
    // Generate appropriate question
    const question = this.questionGenerator.generateQuestion(nextField, specs, nextField.action);
    const progressMessage = this.questionGenerator.generateProgressMessage(
      validation.completionPercentage, 
      validation.missing
    );
    
    return {
      type: 'COLLECT_INFORMATION',
      message: `${progressMessage}\n\n${question}`,
      nextField: nextField,
      validation: validation,
      requiresInput: true
    };
  }
  
  /**
   * Check if a conversation has expired
   * @param {Date|string} lastActivity - Last activity timestamp
   * @returns {boolean} - Whether the conversation has expired
   */
  isConversationExpired(lastActivity) {
    if (!lastActivity) {
      return false;
    }
    
    const lastActivityTime = new Date(lastActivity).getTime();
    const now = Date.now();
    
    return (now - lastActivityTime) > this.expirationWindow;
  }
  
  /**
   * Handle an expired conversation
   * @param {string} userId - User identifier
   * @param {Object} currentSpecs - Current specifications
   * @returns {Object} - Response for expired conversation
   */
  async handleExpiredConversation(userId, currentSpecs) {
    try {
      // Apply defaults for expired conversation
      const specsWithDefaults = this.specValidator.applyDefaults(currentSpecs);
      
      // Save the updated specs
      await this.conversationManager.savePartialSpecification(userId, specsWithDefaults);
      
      // Validate with defaults
      const validation = this.specValidator.validateSpecifications(specsWithDefaults);
      
      logger.info('Applied defaults for expired conversation', {
        userId,
        originalCompleteness: Object.keys(currentSpecs).length,
        withDefaults: Object.keys(specsWithDefaults).length,
        canGenerateQuote: validation.canGenerateQuote
      });
      
      const message = `
Welcome back! I found your previous window quote request from a while ago. 

Since some time has passed, I've applied our standard defaults for any missing information:
${this.formatAppliedDefaults(specsWithDefaults, currentSpecs)}

${validation.canGenerateQuote ? 
  "I can generate a quote with these specifications, or you can update any details." :
  "Let's complete the remaining information needed for your quote."
}`;
      
      // Determine next step with defaults applied
      const nextStep = await this.determineNextStep(userId, specsWithDefaults, validation);
      
      return {
        type: 'EXPIRED_CONVERSATION_RECOVERED',
        message,
        nextStep,
        appliedDefaults: true
      };
      
    } catch (error) {
      logger.logError(error, {
        operation: 'HANDLE_EXPIRED_CONVERSATION',
        userId
      });
      
      return {
        type: 'ERROR',
        message: "Welcome back! Let's start fresh with your window quote. What type of window are you looking for?",
        requiresInput: true
      };
    }
  }
  
  /**
   * Generate a welcome back message for returning users
   * @param {Object} validation - Current validation state
   * @param {Object} specs - Current specifications
   * @returns {string} - Welcome back message
   */
  generateWelcomeBackMessage(validation, specs) {
    const completionPercent = validation.completionPercentage;
    
    if (completionPercent >= 90) {
      return "Welcome back! You're almost done with your window quote - just a few more details needed.";
    }
    
    if (completionPercent >= 70) {
      return "Welcome back! You've provided most of the information for your window quote. Let's finish up.";
    }
    
    if (completionPercent >= 50) {
      return "Welcome back! You're about halfway through your window quote. Let's continue where we left off.";
    }
    
    if (completionPercent > 0) {
      return "Welcome back! I have some information from our previous conversation. Let's continue with your window quote.";
    }
    
    return "Welcome back! Let's continue with your window quote.";
  }
  
  /**
   * Generate message offering quote with defaults
   * @param {Object} validation - Validation results
   * @param {Object} specsWithDefaults - Specifications with defaults applied
   * @returns {string} - Offer message
   */
  generateDefaultsOfferMessage(validation, specsWithDefaults) {
    const missingFields = validation.missing.filter(field => field.priority <= 3);
    
    if (missingFields.length === 0) {
      return "I have enough information to generate your quote! Would you like me to proceed?";
    }
    
    const defaultsApplied = missingFields
      .filter(field => field.default)
      .map(field => `${field.label}: ${field.default}`)
      .join(', ');
    
    if (defaultsApplied) {
      return `I can generate a quote now using these standard options: ${defaultsApplied}.\n\nWould you like me to generate the quote, or would you prefer to specify these details yourself?`;
    }
    
    return "I have the essential information for your quote. Would you like me to generate it now, or provide more specific details?";
  }
  
  /**
   * Format applied defaults for user display
   * @param {Object} specsWithDefaults - Specifications with defaults
   * @param {Object} originalSpecs - Original specifications
   * @returns {string} - Formatted list of applied defaults
   */
  formatAppliedDefaults(specsWithDefaults, originalSpecs) {
    const appliedDefaults = [];
    
    for (const [field, value] of Object.entries(specsWithDefaults)) {
      if (originalSpecs[field] === undefined || originalSpecs[field] === null) {
        const fieldConfig = this.specValidator.requiredFields[field];
        if (fieldConfig && fieldConfig.default === value) {
          appliedDefaults.push(`• ${fieldConfig.label}: ${value}`);
        }
      }
    }
    
    return appliedDefaults.length > 0 ? 
           appliedDefaults.join('\n') : 
           "• Standard energy-efficient options";
  }
  
  /**
   * Continue conversation after successful clarification
   * @param {string} userId - User identifier
   * @param {Object} updatedSpecs - Updated specifications after clarification
   * @param {Object} clarificationResult - Result from clarification process
   * @returns {Object} - Next step in conversation
   */
  async continueAfterClarification(userId, updatedSpecs, clarificationResult) {
    try {
      // Validate the updated specifications
      const validation = this.specValidator.validateSpecifications(updatedSpecs);
      
      // Save progress with updated specs
      await this.saveProgress(userId, updatedSpecs, validation);
      
      // Generate a confirmation message and determine next step
      let confirmationMessage = clarificationResult.message || "Thank you for clarifying!";
      
      // Determine the next step
      const nextStep = await this.determineNextStep(userId, updatedSpecs, validation);
      
      // Combine confirmation with next step
      let combinedMessage = confirmationMessage;
      
      if (nextStep.type === 'COLLECT_INFORMATION') {
        combinedMessage += `\n\n${nextStep.message}`;
      } else if (nextStep.type === 'GENERATE_QUOTE') {
        combinedMessage += "\n\nPerfect! I now have all the information needed for your quote.";
      } else if (nextStep.type === 'OFFER_QUOTE_WITH_DEFAULTS') {
        combinedMessage += `\n\n${nextStep.message}`;
      }
      
      return {
        ...nextStep,
        message: combinedMessage,
        clarificationResolved: true,
        resolvedFields: clarificationResult.resolvedFields || []
      };
      
    } catch (error) {
      logger.logError(error, {
        operation: 'CONTINUE_AFTER_CLARIFICATION',
        userId
      });
      
      return {
        type: 'ERROR',
        message: "I've noted your clarification, but I'm having trouble continuing. Could you please repeat your request?",
        requiresInput: true
      };
    }
  }

  /**
   * Clear conversation state for a user
   * @param {string} userId - User identifier
   */
  async clearConversationState(userId) {
    try {
      await this.conversationManager.clearPartialSpecification(userId);
      await this.conversationManager.clearConversationContext(userId);
      
      logger.info('Cleared conversation state', { userId });
    } catch (error) {
      logger.logError(error, {
        operation: 'CLEAR_CONVERSATION_STATE',
        userId
      });
    }
  }

  /**
   * Assess measurement needs for complex windows
   * @param {string} userId - User identifier
   * @param {Object} specs - Current specifications
   * @param {Object} nextField - Next field to collect
   * @returns {Object|null} - Measurement guidance or null
   */
  async assessMeasurementNeeds(userId, specs, nextField) {
    try {
      // Get user context for assessment
      const userContext = await this.conversationManager.getConversationContext(userId);
      
      // Assess measurement complexity
      const assessment = this.professionalMeasurementService.assessMeasurementComplexity(
        specs, 
        userContext?.metadata || {}
      );
      
      // If professional measurement is recommended
      if (assessment.recommendsProfessional) {
        const guidance = this.professionalMeasurementService.generateMeasurementGuidance(
          specs, 
          assessment
        );
        
        return {
          type: 'MEASUREMENT_GUIDANCE',
          message: this.formatMeasurementGuidance(guidance),
          guidance,
          requiresInput: true,
          options: guidance.alternativeOptions.map(opt => opt.action)
        };
      }
      
      return null;
    } catch (error) {
      logger.warn('Error assessing measurement needs', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Format measurement guidance for user display
   * @param {Object} guidance - Measurement guidance
   * @returns {string} - Formatted message
   */
  formatMeasurementGuidance(guidance) {
    let message = guidance.reasoning + '\n\n';
    
    if (guidance.recommendsProfessional) {
      message += '📏 **Professional Measurement Recommended**\n\n';
      
      if (guidance.complexityFactors.length > 0) {
        message += 'Complexity factors:\n';
        guidance.complexityFactors.forEach(factor => {
          message += `• ${factor}\n`;
        });
        message += '\n';
      }
      
      message += 'Benefits of professional measurement:\n';
      guidance.professionalBenefits.forEach(benefit => {
        message += `• ${benefit}\n`;
      });
      message += '\n';
      
      message += '**Your Options:**\n';
      guidance.alternativeOptions.forEach((option, index) => {
        message += `${index + 1}. ${option.option}: ${option.description}\n`;
      });
    } else {
      message += '📏 **DIY Measurement Guide**\n\n';
      
      message += 'Tools needed:\n';
      guidance.diyGuidance.tools.forEach(tool => {
        message += `• ${tool}\n`;
      });
      message += '\n';
      
      message += 'Measurement tips:\n';
      guidance.diyGuidance.tips.forEach(tip => {
        message += `• ${tip}\n`;
      });
      message += '\n';
      
      message += guidance.validationOffer;
    }
    
    return message;
  }

  /**
   * Handle measurement deferral request
   * @param {string} userId - User identifier
   * @param {string} reason - Deferral reason
   * @param {Object} currentSpecs - Current specifications
   * @returns {Object} - Deferral result
   */
  async handleMeasurementDeferral(userId, reason, currentSpecs) {
    try {
      const context = await this.conversationManager.getConversationContext(userId);
      const deferralResult = await this.measurementDeferralService.createDeferral(
        userId, 
        reason, 
        currentSpecs,
        context?.metadata || {}
      );
      
      if (deferralResult.success) {
        return {
          type: 'MEASUREMENT_DEFERRED',
          message: this.formatDeferralResponse(deferralResult),
          deferralId: deferralResult.deferralId,
          requiresInput: false
        };
      } else {
        return {
          type: 'ERROR',
          message: deferralResult.error,
          requiresInput: true
        };
      }
    } catch (error) {
      logger.logError(error, {
        operation: 'HANDLE_MEASUREMENT_DEFERRAL',
        userId
      });
      
      return {
        type: 'ERROR',
        message: "I couldn't save your quote request. Let's continue with the measurements when you're ready.",
        requiresInput: true
      };
    }
  }

  /**
   * Format deferral response for user display
   * @param {Object} deferralResult - Deferral result
   * @returns {string} - Formatted message
   */
  formatDeferralResponse(deferralResult) {
    const { guidance, resumptionInstructions } = deferralResult;
    
    let message = guidance.message + '\n\n';
    
    if (guidance.savedInfo.length > 0) {
      message += '✅ **Saved Information:**\n';
      guidance.savedInfo.forEach(info => {
        message += `• ${info}\n`;
      });
      message += '\n';
    }
    
    if (guidance.resources) {
      message += '📚 **Resources:**\n';
      guidance.resources.forEach(resource => {
        message += `• ${resource}\n`;
      });
      message += '\n';
    }
    
    if (guidance.nextSteps.length > 0) {
      message += '**Next Steps:**\n';
      guidance.nextSteps.forEach(step => {
        message += `• ${step}\n`;
      });
      message += '\n';
    }
    
    message += `**Your Quote Reference:** ${guidance.deferralId}\n\n`;
    message += `To resume: ${resumptionInstructions.method1}`;
    
    return message;
  }

  /**
   * Handle quote resumption
   * @param {string} userId - User identifier
   * @param {string} deferralId - Deferral ID
   * @returns {Object} - Resumption result
   */
  async handleQuoteResumption(userId, deferralId) {
    try {
      const resumptionResult = await this.measurementDeferralService.resumeDeferredQuote(
        userId, 
        deferralId
      );
      
      if (resumptionResult.success) {
        // Update current specs
        await this.saveProgress(userId, resumptionResult.partialSpecs, {});
        
        return {
          type: 'QUOTE_RESUMED',
          message: resumptionResult.message,
          specs: resumptionResult.partialSpecs,
          missingFields: resumptionResult.missingFields,
          requiresInput: true
        };
      } else {
        return {
          type: 'RESUMPTION_FAILED',
          message: resumptionResult.error,
          suggestion: resumptionResult.suggestion,
          requiresInput: true
        };
      }
    } catch (error) {
      logger.logError(error, {
        operation: 'HANDLE_QUOTE_RESUMPTION',
        userId,
        deferralId
      });
      
      return {
        type: 'ERROR',
        message: "I couldn't find your saved quote. Let's start fresh - what type of window are you looking for?",
        requiresInput: true
      };
    }
  }
}

module.exports = ConversationFlowService;