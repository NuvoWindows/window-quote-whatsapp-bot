const claudeService = require('../services/claudeService');
const whatsappService = require('../services/whatsappService');
const messageParser = require('../utils/messageParser');

// In-memory conversation storage (in production, use a database)
const conversations = new Map();

class WhatsAppController {
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('Webhook verified!');
        return res.status(200).send(challenge);
      }
    }
    
    return res.sendStatus(403);
  }
  
  async handleMessage(req, res) {
    try {
      const body = req.body;
      
      // Check if this is a valid WhatsApp message
      if (!body.object || !body.entry || !body.entry[0].changes || !body.entry[0].changes[0].value.messages) {
        return res.sendStatus(400);
      }
      
      // Process the message
      const messageData = body.entry[0].changes[0].value;
      const message = messageData.messages[0];
      
      if (message.type !== 'text') {
        await whatsappService.sendMessage(
          messageData.contacts[0].wa_id,
          "I can only process text messages. Please send your question as text."
        );
        return res.sendStatus(200);
      }
      
      // Mark the message as read
      await whatsappService.markMessageAsRead(message.id);
      
      // Get user info
      const phone = messageData.contacts[0].wa_id;
      const name = messageData.contacts[0].profile.name || 'there';
      
      // Get or create conversation history
      if (!conversations.has(phone)) {
        conversations.set(phone, [
          {
            role: "assistant", 
            content: `Hi ${name}! I'm your window quote assistant. How can I help you today?`
          }
        ]);
      }
      
      const conversationHistory = conversations.get(phone);
      
      // Add user message to history
      conversationHistory.push({
        role: "user",
        content: message.text.body
      });
      
      // Generate response using Claude
      const response = await claudeService.generateResponse(
        message.text.body,
        conversationHistory.slice(-10) // Keep only last 10 messages for context
      );
      
      // Add Claude's response to history
      conversationHistory.push({
        role: "assistant",
        content: response
      });
      
      // Send response to user
      await whatsappService.sendMessage(phone, response);
      
      return res.sendStatus(200);
    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
      return res.sendStatus(500);
    }
  }
}

module.exports = new WhatsAppController();