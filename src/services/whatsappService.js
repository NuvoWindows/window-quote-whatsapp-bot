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
      console.log(`Sending to: ${to}`);
      
      // Clean the phone number (remove any +, spaces, etc.)
      const cleanPhone = to.toString().replace(/\D/g, '');
      console.log(`Cleaned phone: ${cleanPhone}`);
      
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: message }
      };
      
      console.log('Request payload:', JSON.stringify(payload));
      
      const response = await axios.post(
        `https://graph.facebook.com/${config.whatsapp.apiVersion}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data));
      
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
          headers: JSON.stringify(error.response.headers)
        });
      } else {
        console.error('No response object available');
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