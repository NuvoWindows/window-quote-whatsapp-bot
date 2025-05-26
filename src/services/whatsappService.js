const axios = require('axios');
const config = require('../config/config');
const RetryUtil = require('../utils/retryUtil');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.baseUrl = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.accessToken = config.whatsapp.accessToken;
    
    // Create retry utility for WhatsApp operations
    this.retryUtil = new RetryUtil({
      maxRetries: parseInt(process.env.WHATSAPP_MAX_RETRIES || '4'),
      baseDelayMs: parseInt(process.env.WHATSAPP_BASE_DELAY_MS || '800'),
      maxDelayMs: parseInt(process.env.WHATSAPP_MAX_DELAY_MS || '8000')
    });
  }

  async sendMessage(to, message) {
    try {
      return await this.retryUtil.executeWithRetry(
        // The operation to perform
        async () => {
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
        },
        
        // WhatsApp-specific retry check
        (error) => this.isRetryableWhatsAppError(error),
        
        // Context for logging
        { 
          operation: 'WHATSAPP_SEND_MESSAGE',
          recipient: to
        }
      );
    } catch (error) {
      // Handle exhausted retries
      if (error.retryInfo?.exhausted) {
        logger.logError(error, {
          operation: 'WHATSAPP_SEND_MESSAGE',
          retriesExhausted: true,
          attempts: error.retryInfo.attempts,
          recipient: to,
          messagePreview: message.substring(0, 50) + '...'
        });
      }
      
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

  /**
   * Determine if a WhatsApp API error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether the error is retryable
   */
  isRetryableWhatsAppError(error) {
    // HTTP status errors
    if (error.response?.status >= 500) {
      return true; // Server errors are generally retryable
    }
    
    // Rate limiting
    if (error.response?.status === 429) {
      return true;
    }
    
    // Network errors
    if (error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }
    
    // Axios network errors
    if (error.message && (
        error.message.includes('Network Error') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET'))) {
      return true;
    }
    
    // Message-specific errors that might be transient
    if (error.response?.data?.error?.message && (
        error.response.data.error.message.includes('temporary') ||
        error.response.data.error.message.includes('retry') ||
        error.response.data.error.message.includes('unavailable'))) {
      return true;
    }
    
    return false;
  }
}

module.exports = new WhatsAppService();