require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    retries: {
      maxAttempts: parseInt(process.env.CLAUDE_MAX_RETRIES || '3'),
      baseDelayMs: parseInt(process.env.CLAUDE_RETRY_BASE_DELAY_MS || '300'),
      maxDelayMs: parseInt(process.env.CLAUDE_RETRY_MAX_DELAY_MS || '3000')
    }
  }
};