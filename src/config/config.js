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
    apiKey: process.env.CLAUDE_API_KEY
  }
};