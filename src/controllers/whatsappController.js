const claudeService = require('../services/claudeService');
const whatsappService = require('../services/whatsappService');
const messageParser = require('../utils/messageParser');

// In-memory conversation storage (in production, use a database)
const conversations = new Map();

class WhatsAppController {
  async verifyWebhook(req, res) {
    console.log('=== WEBHOOK VERIFICATION ===');
    console.log('Query params:', req.query);
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log(`Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);
    console.log(`Expected verify token: ${process.env.WHATSAPP_VERIFY_TOKEN}`);
    
    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('Webhook verified successfully!');
        return res.status(200).send(challenge);
      }
    }
    
    console.log('Webhook verification failed!');
    return res.sendStatus(403);
  }
  
  async handleMessage(req, res) {
    try {
      console.log('=== WEBHOOK RECEIVED ===');
      console.log('Body:', JSON.stringify(req.body));
      
      const body = req.body;
      
      // Validate the incoming webhook
      if (!body.object || !body.entry || !body.entry[0].changes || !body.entry[0].changes[0].value.messages) {
        console.log('Invalid webhook format received');
        return res.sendStatus(400);
      }
      
      // Process the message
      const messageData = body.entry[0].changes[0].value;
      const message = messageData.messages[0];
      
      console.log('Message ID:', message.id);
      console.log('Message type:', message.type);
      if (message.type === 'text') {
        console.log('Message content:', message.text.body);
      }
      
      if (message.type !== 'text') {
        console.log('Received non-text message, sending response about text-only support');
        await whatsappService.sendMessage(
          messageData.contacts[0].wa_id,
          "I can only process text messages. Please send your question as text."
        );
        return res.sendStatus(200);
      }
      
      // Get user info
      const phone = messageData.contacts[0].wa_id;
      const name = messageData.contacts[0].profile.name || 'there';
      console.log(`Message from phone: ${phone}, name: ${name}`);
      
      // Respond to the message
      try {
        // Mark the message as read
        await whatsappService.markMessageAsRead(message.id);
        console.log('Message marked as read');
        
        // Add a test command for basic verification
        if (message.text.body.toLowerCase() === 'test') {
          console.log('Test command received, sending direct response');
          await whatsappService.sendMessage(phone, "This is a test response. If you see this, basic messaging is working!");
          return res.sendStatus(200);
        }
        
        // Get or create conversation history
        if (!conversations.has(phone)) {
          console.log('Creating new conversation for phone:', phone);
          conversations.set(phone, [
            {
              role: "assistant",
              content: `Hi ${name}! I'm your window quote assistant. How can I help you today?`
            }
          ]);
        }
        
        const conversationHistory = conversations.get(phone);
        console.log('Conversation history length:', conversationHistory.length);
        
        // Add user message to history
        conversationHistory.push({
          role: "user",
          content: message.text.body
        });
        
        // Generate response using Claude
        console.log('Calling Claude API...');
        const response = await claudeService.generateResponse(
          message.text.body,
          conversationHistory.slice(-10) // Keep only last 10 messages for context
        );
        console.log('Claude response received, length:', response.length);
        
        // Add Claude's response to history
        conversationHistory.push({
          role: "assistant",
          content: response
        });
        
        // Send response to user
        console.log('Sending response to WhatsApp...');
        const result = await whatsappService.sendMessage(phone, response);
        console.log('WhatsApp send result:', JSON.stringify(result));
        
        return res.sendStatus(200);
      } catch (innerError) {
        console.error('Error in message processing:', innerError);
        console.error('Error stack:', innerError.stack);
        
        // Try to send an error message to the user
        try {
          await whatsappService.sendMessage(phone, 
            "I'm sorry, I encountered an error processing your request. Our team has been notified."
          );
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
        
        return res.sendStatus(500);
      }
    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
      console.error('Error stack:', error.stack);
      return res.sendStatus(500);
    }
  }
}

module.exports = new WhatsAppController();