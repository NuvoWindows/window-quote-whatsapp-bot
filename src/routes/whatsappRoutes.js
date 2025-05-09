const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const quoteController = require('../controllers/quoteController');

const router = express.Router();

// WhatsApp webhook verification
router.get('/webhook', whatsappController.verifyWebhook);

// WhatsApp message handling
router.post('/webhook', whatsappController.handleMessage);

// Quote generation API endpoint
router.post('/generate-quote', quoteController.generateQuote);

module.exports = router;