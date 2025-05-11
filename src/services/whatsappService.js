const axios = require('axios');
const config = require('../config/config');

class WhatsAppService {
  constructor() {
    this.baseUrl = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.accessToken = config.whatsapp.accessToken;
  }

  async sendMessage(to, message) {
    try {
      console.log(`Attempting to send message to ${to}. Message length: ${message.length}`);
      console.log('First 50 chars of message:', message.substring(0, 50) + '...');
      
      // Log important config values (sanitized)
      console.log('Using WhatsApp API version:', config.whatsapp.apiVersion);
      console.log('Phone Number ID present:', !!config.whatsapp.phoneNumberId);
      console.log('Access Token present:', !!config.whatsapp.accessToken);

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "valid-whatsapp-number",
          type: "text",
          text: { body: "Your message text here" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Full API response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data));

      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      
      // Check for rate limiting errors (HTTP 429)
      if (error.response && error.response.status === 429) {
        console.error('RATE LIMITED! WhatsApp API throttling detected.');
        console.error('Retry-After:', error.response.headers['retry-after']);
        // Add delay or backoff logic here if needed
        return { error: 'Rate limit exceeded. Please try again later.' };
      }
      
      throw error;
    }
  }

  async markMessageAsRead(messageId) {
    try {
      await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Error marking message as read:', error.response?.data || error.message);
    }
  }
}

module.exports = new WhatsAppService();