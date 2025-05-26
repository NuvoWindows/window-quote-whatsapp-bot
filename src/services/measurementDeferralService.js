const logger = require('../utils/logger');

class MeasurementDeferralService {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
    this.deferralReasons = {
      NEED_TOOLS: 'need_tools',
      NEED_ACCESS: 'need_access',
      NEED_PROFESSIONAL: 'need_professional',
      NEED_DAYLIGHT: 'need_daylight',
      NEED_ASSISTANCE: 'need_assistance',
      PREFER_LATER: 'prefer_later'
    };

    this.deferralGuidance = {
      need_tools: {
        message: "No problem! You'll need a tape measure for accurate measurements.",
        resources: ['Measurement guide PDF', 'Tool checklist', 'Where to buy/rent tools'],
        estimatedTime: '5-10 minutes once you have tools'
      },
      need_access: {
        message: "I understand. Window measurements do require clear access to the window area.",
        tips: ['Remove window treatments temporarily', 'Clear furniture if needed', 'Ensure ladder safety for high windows'],
        estimatedTime: '15-30 minutes including preparation'
      },
      need_professional: {
        message: "That's a wise choice for complex windows. Professional measurements ensure accuracy.",
        options: ['Book professional through us', 'Find your own professional', 'Get rough estimate now'],
        estimatedTime: '2-3 business days for professional visit'
      },
      need_daylight: {
        message: "Good thinking! Natural light does make measuring easier and more accurate.",
        bestTimes: ['Morning light is ideal', 'Avoid direct sunlight glare', 'Overcast days work well too'],
        estimatedTime: 'Next daylight hours'
      },
      need_assistance: {
        message: "Having a helper does make window measurement much easier, especially for larger windows.",
        whyHelper: ['Hold tape measure steady', 'Record measurements', 'Safety for ladder work'],
        estimatedTime: 'When helper is available'
      },
      prefer_later: {
        message: "No rush! We'll save your quote request and you can complete it when convenient.",
        preservation: ['Your specifications are saved', 'Quote request ID for easy resumption', 'No need to start over'],
        estimatedTime: 'Whenever you\'re ready'
      }
    };
  }

  async createDeferral(userId, reason, partialSpecs, additionalContext = {}) {
    try {
      const deferralId = `def_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
      
      const deferralData = {
        deferralId,
        reason: reason || this.deferralReasons.PREFER_LATER,
        createdAt: new Date().toISOString(),
        partialSpecs,
        additionalContext,
        status: 'active',
        remindersSent: 0,
        lastReminderAt: null
      };

      // Save deferral data to conversation context
      await this.conversationManager.saveConversationContext(userId, {
        hasDeferredQuote: true,
        deferralData,
        lastUserIntent: 'defer_measurement'
      });

      // Generate appropriate response based on reason
      const guidance = this.generateDeferralResponse(reason, deferralId, partialSpecs);

      logger.info(`Created measurement deferral ${deferralId} for user ${userId}`, {
        reason,
        hasPartialSpecs: Object.keys(partialSpecs).length > 0
      });

      return {
        success: true,
        deferralId,
        guidance,
        resumptionInstructions: this.generateResumptionInstructions(deferralId)
      };

    } catch (error) {
      logger.error('Error creating measurement deferral:', error);
      return {
        success: false,
        error: 'Failed to save your quote request. Please try again.'
      };
    }
  }

  generateDeferralResponse(reason, deferralId, partialSpecs) {
    const baseGuidance = this.deferralGuidance[reason] || this.deferralGuidance.prefer_later;
    
    const response = {
      message: baseGuidance.message,
      deferralId,
      savedInfo: this.summarizeSavedSpecs(partialSpecs),
      nextSteps: []
    };

    // Add reason-specific content
    if (reason === this.deferralReasons.NEED_TOOLS) {
      response.resources = baseGuidance.resources;
      response.nextSteps.push('Get a tape measure (hardware store or borrow)');
      response.nextSteps.push(`Text "RESUME ${deferralId}" when ready`);
    } else if (reason === this.deferralReasons.NEED_PROFESSIONAL) {
      response.professionalOptions = baseGuidance.options;
      response.nextSteps.push('Book professional measurement');
      response.nextSteps.push('Or get rough estimate now');
    } else if (reason === this.deferralReasons.NEED_DAYLIGHT) {
      response.timing = baseGuidance.bestTimes;
      response.nextSteps.push('Set reminder for tomorrow morning');
      response.nextSteps.push(`Resume with code: ${deferralId}`);
    }

    // Add estimated time if available
    if (baseGuidance.estimatedTime) {
      response.estimatedTime = baseGuidance.estimatedTime;
    }

    return response;
  }

  summarizeSavedSpecs(partialSpecs) {
    const saved = [];
    
    if (partialSpecs.windowCount) saved.push(`${partialSpecs.windowCount} windows`);
    if (partialSpecs.type) saved.push(`Type: ${partialSpecs.type}`);
    if (partialSpecs.material) saved.push(`Material: ${partialSpecs.material}`);
    if (partialSpecs.features?.length) saved.push(`Features: ${partialSpecs.features.join(', ')}`);
    
    return saved.length > 0 ? saved : ['Your initial specifications'];
  }

  generateResumptionInstructions(deferralId) {
    return {
      method1: `Text "RESUME ${deferralId}" to continue where you left off`,
      method2: 'Text "CONTINUE QUOTE" and provide your reference number',
      method3: 'Start fresh with a new quote request anytime',
      expirationNote: 'Your saved quote is valid for 30 days'
    };
  }

  async resumeDeferredQuote(userId, deferralId) {
    try {
      const context = await this.conversationManager.getConversationContext(userId);
      
      if (!context?.metadata?.deferralData || 
          context.metadata.deferralData.deferralId !== deferralId) {
        
        // Try to find by ID in case user switched devices
        const searchResult = await this.searchDeferralById(deferralId);
        if (!searchResult.found) {
          return {
            success: false,
            error: 'Quote reference not found. Please check your reference number or start a new quote.'
          };
        }
        
        // Restore context from search
        context.metadata = searchResult.data;
      }

      const deferralData = context.metadata.deferralData;
      
      // Check if expired (30 days)
      const createdDate = new Date(deferralData.createdAt);
      const daysSinceCreation = (Date.now() - createdDate) / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreation > 30) {
        return {
          success: false,
          error: 'This quote request has expired. Please start a new quote.',
          suggestion: 'We can use your saved information to speed up the process.'
        };
      }

      // Mark as resumed
      deferralData.status = 'resumed';
      deferralData.resumedAt = new Date().toISOString();
      
      await this.conversationManager.saveConversationContext(userId, {
        hasDeferredQuote: false,
        deferralData,
        lastUserIntent: 'resume_quote'
      });

      return {
        success: true,
        partialSpecs: deferralData.partialSpecs,
        reason: deferralData.reason,
        message: this.generateResumptionMessage(deferralData),
        missingFields: this.identifyMissingFields(deferralData.partialSpecs)
      };

    } catch (error) {
      logger.error('Error resuming deferred quote:', error);
      return {
        success: false,
        error: 'Failed to resume your quote. Please try again or start fresh.'
      };
    }
  }

  async searchDeferralById(deferralId) {
    // In production, this would search a database
    // For now, return not found
    return { found: false };
  }

  generateResumptionMessage(deferralData) {
    const messages = {
      need_tools: "Welcome back! Have you got your measuring tools ready?",
      need_access: "Great! Is the window area now accessible for measurements?",
      need_professional: "Welcome back! Did you get professional measurements, or would you like to proceed with estimates?",
      need_daylight: "Perfect timing! Ready to measure your windows now?",
      need_assistance: "Excellent! Do you have someone to help you measure?",
      prefer_later: "Welcome back! Ready to complete your window quote?"
    };

    return messages[deferralData.reason] || messages.prefer_later;
  }

  identifyMissingFields(partialSpecs) {
    const required = ['width', 'height', 'type'];
    const missing = [];

    for (const field of required) {
      if (!partialSpecs[field]) {
        missing.push(field);
      }
    }

    // Check for window-specific missing fields
    if (partialSpecs.windowCount > 1 && !partialSpecs.windows) {
      missing.push('individual window measurements');
    }

    return missing;
  }

  async sendDeferralReminder(userId, deferralData) {
    const daysSinceDeferral = (Date.now() - new Date(deferralData.createdAt)) / (1000 * 60 * 60 * 24);
    
    // Send reminders at 3, 7, and 14 days
    const reminderSchedule = [3, 7, 14];
    const shouldSendReminder = reminderSchedule.some(day => 
      Math.floor(daysSinceDeferral) === day && deferralData.remindersSent < reminderSchedule.indexOf(day) + 1
    );

    if (shouldSendReminder) {
      const reminderMessage = this.generateReminderMessage(deferralData, daysSinceDeferral);
      
      deferralData.remindersSent++;
      deferralData.lastReminderAt = new Date().toISOString();
      
      await this.conversationManager.saveConversationContext(userId, {
        deferralData
      });

      return {
        shouldSend: true,
        message: reminderMessage
      };
    }

    return { shouldSend: false };
  }

  generateReminderMessage(deferralData, daysSinceDeferral) {
    const baseMessage = `Hi! You started a window quote ${Math.floor(daysSinceDeferral)} days ago.`;
    
    const reasonMessages = {
      need_tools: "If you've got your measuring tools now, you can resume your quote anytime!",
      need_professional: "Have you had a chance to get professional measurements?",
      need_daylight: "Ready to measure your windows? Natural light is perfect right now!",
      default: "Ready to complete your window quote?"
    };

    const reasonMessage = reasonMessages[deferralData.reason] || reasonMessages.default;
    
    return `${baseMessage} ${reasonMessage}\n\nResume with: "${deferralData.deferralId}"`;
  }

  async cleanupExpiredDeferrals() {
    // This would be run as a scheduled job in production
    // Removes deferrals older than 30 days
    logger.info('Cleanup of expired deferrals would run here');
  }
}

module.exports = MeasurementDeferralService;