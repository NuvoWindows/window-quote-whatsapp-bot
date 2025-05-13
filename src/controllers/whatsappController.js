const claudeService = require('../services/claudeService');
const whatsappService = require('../services/whatsappService');
const messageParser = require('../utils/messageParser');
const logger = require('../utils/logger');
const conversationManager = require('../services/conversationManager');

class WhatsAppController {
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

        // Get conversation context from persistent storage
        logger.info('Getting conversation context', { user: phone, user_name: name });

        // First, check if this is a new conversation that needs a welcome message
        const existingMessages = await conversationManager.getConversationContext(phone, 1);
        if (existingMessages.length === 0) {
          // This is a new conversation, add a welcome message
          logger.info('Adding welcome message for new conversation', { user: phone });
          await conversationManager.addMessage(
            phone,
            'assistant',
            `Hi ${name}! I'm your window quote assistant. How can I help you today?`
          );
        }

        // Save the user's message to the conversation
        await conversationManager.addMessage(phone, 'user', message.text.body);

        // Get the updated conversation context
        const conversationContext = await conversationManager.getConversationContext(phone);

        logger.debug('Conversation context status', {
          user: phone,
          context_messages: conversationContext.length
        });

        // Generate response using Claude
        logger.info('Calling Claude API', {
          user: phone,
          message_length: message.text.body.length
        });

        const response = await claudeService.generateResponse(
          message.text.body,
          conversationContext, // Use all messages from conversation manager
          { phone, name } // Pass user information for detailed logging
        );

        logger.info('Claude response received', {
          user: phone,
          response_length: response.length
        });

        // Save Claude's response to conversation
        await conversationManager.addMessage(phone, 'assistant', response);

        // Send response to user
        logger.info('Sending response to WhatsApp', { user: phone });
        const result = await whatsappService.sendMessage(phone, response);
        logger.debug('WhatsApp send result', { user: phone, result });
        
        return res.sendStatus(200);
      } catch (innerError) {
        // Try to send an error message to the user
        try {
          // Log the error using the logger
          logger.error('WhatsApp message processing error', {
            error: innerError.message,
            stack: innerError.stack,
            user: phone,
            user_name: name
          });

          await whatsappService.sendMessage(phone,
            "I'm sorry, I encountered an error processing your request. Our team has been notified."
          );
        } catch (sendError) {
          logger.error('Failed to send error message to user', {
            original_error: innerError.message,
            send_error: sendError.message,
            user: phone
          });
        }
        
        return res.sendStatus(500);
      }
    } catch (error) {
      // Log the error with structured logging
      logger.error('WhatsApp webhook handling error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      return res.sendStatus(500);
    }
  }
}

module.exports = new WhatsAppController();