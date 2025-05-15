/**
 * Quote Routes
 * Routes for window quote generation and retrieval
 */

const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const logger = require('../utils/logger');

/**
 * @route POST /api/quotes/calculate
 * @description Calculate a simple window quote from a text message
 * @access Public
 */
router.post('/calculate', quoteController.generateQuote);

/**
 * @route POST /api/quotes/detailed
 * @description Calculate a detailed window quote with all options
 * @access Public
 */
router.post('/detailed', quoteController.generateDetailedQuote);

/**
 * @route POST /api/quotes/from-conversation
 * @description Calculate a quote based on conversation messages
 * @access Public
 */
router.post('/from-conversation', quoteController.generateQuoteFromConversation);

/**
 * @route GET /api/quotes/details
 * @description Get detailed quote information as HTML
 * @access Public
 */
router.get('/details', quoteController.getQuoteDetails);

/**
 * @route GET /api/quotes/sample
 * @description Get a sample quote for demonstration
 * @access Public
 */
router.get('/sample', quoteController.getSampleQuote);

module.exports = router;