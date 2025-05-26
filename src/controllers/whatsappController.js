const claudeService = require('../services/claudeService');
const whatsappService = require('../services/whatsappService');
const messageParser = require('../utils/messageParser');
const logger = require('../utils/logger');
const conversationManager = require('../services/conversationManager');

// Error handling components
const ConversationFlowService = require('../services/conversationFlowService');
const ErrorContextService = require('../services/errorContextService');
const ErrorRecoveryService = require('../services/errorRecoveryService');
const errorMonitoringService = require('../services/errorMonitoringService');

class WhatsAppController {
  constructor() {
    // Initialize error handling services
    this.conversationFlowService = new ConversationFlowService();
    this.errorContextService = new ErrorContextService();
    this.errorRecoveryService = new ErrorRecoveryService();
  }

  async verifyWebhook(req, res) {

    logger.info('Webhook verification request received', {
      query: req.query,
      ip: req.ip
    });

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.debug('Webhook verification details', {
      mode,
      token_received: !!token,
      challenge_received: !!challenge,
      expected_token: `${process.env.WHATSAPP_VERIFY_TOKEN?.substring(0, 3)}...`
    });

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info('Webhook verified successfully!');
        return res.status(200).send(challenge);
      }
    }

    logger.warn('Webhook verification failed!', {
      mode,
      token_matched: token === process.env.WHATSAPP_VERIFY_TOKEN
    });
    return res.sendStatus(403);
  }
  
  async handleMessage(req, res) {
    try {

      logger.info('WhatsApp webhook received', {
        ip: req.ip,
        body_size: JSON.stringify(req.body).length,
        headers: req.headers
      });

      // Log detailed request body at debug level
      logger.debug('WhatsApp webhook body details', {
        body: req.body
      });

      const body = req.body;

      // Validate the incoming webhook
      if (!body.object || !body.entry || !body.entry[0].changes || !body.entry[0].changes[0].value.messages) {
        logger.warn('Invalid webhook format received', { body });
        return res.sendStatus(400);
      }
      
      // Process the message
      const messageData = body.entry[0].changes[0].value;
      const message = messageData.messages[0];

      // Get user info - with proper error handling for missing fields
      let phone = 'unknown';
      let name = 'there';

      try {
        if (messageData.contacts && messageData.contacts[0]) {
          phone = messageData.contacts[0].wa_id || 'unknown';
          name = (messageData.contacts[0].profile && messageData.contacts[0].profile.name) || 'there';
        }
      } catch (userInfoError) {
        logger.warn('Failed to extract user info from message', { error: userInfoError.message });
      }

      logger.info('Message received', {
        message_id: message.id,
        message_type: message.type,
        user: phone,
        user_name: name,
        content: message.type === 'text' ? message.text.body.substring(0, 50) + (message.text.body.length > 50 ? '...' : '') : '[NON-TEXT]'
      });

      if (message.type !== 'text') {
        logger.info('Non-text message received, sending fallback response', {
          message_type: message.type,
          user: phone
        });

        await whatsappService.sendMessage(
          messageData.contacts[0].wa_id,
          "I can only process text messages. Please send your question as text."
        );
        return res.sendStatus(200);
      }
      
      // Respond to the message
      try {
        // Mark the message as read
        await whatsappService.markMessageAsRead(message.id);
        logger.debug('Message marked as read', { message_id: message.id });

        // Add a test command for basic verification
        if (message.text.body.toLowerCase() === 'test') {
          logger.info('Test command received, sending direct response', { user: phone });
          await whatsappService.sendMessage(phone, "This is a test response. If you see this, basic messaging is working!");
          return res.sendStatus(200);
        }

        // Use ConversationFlowService to process the message with comprehensive error handling
        logger.info('Processing message with ConversationFlowService', { user: phone, user_name: name });
        
        const result = await this.conversationFlowService.processUserMessage(
          phone, 
          message.text.body,
          {}, // extractedSpecs - could be enhanced with messageParser integration
          { name } // additional context
        );

        logger.info('ConversationFlowService result', {
          user: phone,
          result_type: result.type,
          has_response: !!result.response,
          has_clarification: !!result.clarificationRequest
        });

        // Handle different response types
        let responseText;
        
        if (result.type === 'clarification_needed') {
          responseText = result.clarificationRequest;
          logger.debug('Sending clarification request', { user: phone });
        } else if (result.type === 'error_recovery') {
          responseText = result.response;
          logger.debug('Sending error recovery response', { user: phone });
        } else if (result.type === 'success') {
          responseText = result.response;
          logger.debug('Sending successful response', { user: phone });
        } else {
          // Fallback to standard Claude response for unhandled cases
          logger.info('Falling back to standard Claude response', { user: phone });
          
          // First, check if this is a new conversation that needs a welcome message
          const existingMessages = await conversationManager.getConversationContext(phone, 1);
          if (existingMessages.length === 0) {
            logger.info('Adding welcome message for new conversation', { user: phone });
            await conversationManager.addMessage(
              phone,
              'assistant',
              `Hi ${name}! I'm your window quote assistant. How can I help you today?`
            );
          }

          // Save the user's message to the conversation
          await conversationManager.addMessage(phone, 'user', message.text.body);

          // Get conversation context and generate response
          const conversationContext = await conversationManager.getConversationContext(phone);
          responseText = await claudeService.generateResponse(
            message.text.body,
            conversationContext,
            { phone, name }
          );

          // Save Claude's response to conversation
          await conversationManager.addMessage(phone, 'assistant', responseText);
        }

        // Send response to user
        logger.info('Sending response to WhatsApp', { user: phone, response_length: responseText.length });
        await whatsappService.sendMessage(phone, responseText);
        
        return res.sendStatus(200);
        
      } catch (innerError) {
        // Use comprehensive error handling system
        const operation = 'whatsapp_message_processing';
        
        try {
          // Capture comprehensive error context
          const errorContext = await this.errorContextService.captureErrorContext(
            phone, 
            innerError, 
            operation
          );

          // Track the error for monitoring
          await errorMonitoringService.trackError(innerError, operation, phone);

          // Attempt error recovery
          const recoveryResult = await this.errorRecoveryService.handleError(
            phone, 
            innerError, 
            operation, 
            errorContext
          );

          if (recoveryResult.success && recoveryResult.userMessage) {
            // Send recovery message to user
            await whatsappService.sendMessage(phone, recoveryResult.userMessage);
            logger.info('Error recovery successful', { 
              user: phone, 
              recovery_strategy: recoveryResult.strategy 
            });
          } else {
            // Recovery failed, send generic error message
            await whatsappService.sendMessage(phone,
              "I'm sorry, I encountered an error processing your request. Our team has been notified."
            );
            logger.error('Error recovery failed', { 
              user: phone, 
              error: innerError.message,
              recovery_attempted: recoveryResult.strategy 
            });
          }

        } catch (errorHandlingError) {
          // Final fallback if even our error handling fails
          logger.error('Error handling system failed', {
            original_error: innerError.message,
            error_handling_error: errorHandlingError.message,
            user: phone
          });

          try {
            await whatsappService.sendMessage(phone,
              "I'm experiencing technical difficulties. Please try again in a moment."
            );
          } catch (sendError) {
            logger.error('Failed to send final fallback message', {
              user: phone,
              send_error: sendError.message
            });
          }
        }
        
        return res.sendStatus(500);
      }
    } catch (error) {
      // Log the error with structured logging and track for monitoring
      logger.error('WhatsApp webhook handling error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      // Track webhook-level errors for monitoring
      try {
        await errorMonitoringService.trackError(error, 'whatsapp_webhook', 'system');
      } catch (monitoringError) {
        logger.error('Failed to track webhook error', { 
          original_error: error.message,
          monitoring_error: monitoringError.message 
        });
      }

      return res.sendStatus(500);
    }
  }
}

module.exports = new WhatsAppController();