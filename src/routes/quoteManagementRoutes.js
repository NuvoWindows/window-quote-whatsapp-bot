/**
 * Quote Management Routes
 * Routes for managing multi-window quotes
 */

const express = require('express');
const router = express.Router();
const quoteManagementController = require('../controllers/quoteManagementController');
const logger = require('../utils/logger');

/**
 * @route POST /api/quote-management/quotes
 * @description Create a new quote
 * @access Public
 */
router.post('/quotes', quoteManagementController.createQuote);

/**
 * @route GET /api/quote-management/quotes/:id
 * @description Get a quote by ID
 * @access Public
 */
router.get('/quotes/:id', quoteManagementController.getQuote);

/**
 * @route PUT /api/quote-management/quotes/:id
 * @description Update a quote
 * @access Public
 */
router.put('/quotes/:id', quoteManagementController.updateQuote);

/**
 * @route DELETE /api/quote-management/quotes/:id
 * @description Delete a quote
 * @access Public
 */
router.delete('/quotes/:id', quoteManagementController.deleteQuote);

/**
 * @route GET /api/quote-management/quotes
 * @description Get recent quotes
 * @access Public
 */
router.get('/quotes', quoteManagementController.getRecentQuotes);

/**
 * @route GET /api/quote-management/quotes/customer/:customerId
 * @description Get quotes by customer ID
 * @access Public
 */
router.get('/quotes/customer/:customerId', quoteManagementController.getQuotesByCustomer);

/**
 * @route GET /api/quote-management/quotes/conversation/:conversationId
 * @description Get quotes by conversation ID
 * @access Public
 */
router.get('/quotes/conversation/:conversationId', quoteManagementController.getQuotesByConversation);

/**
 * @route POST /api/quote-management/quotes/from-conversation/:conversationId
 * @description Create a quote from a conversation
 * @access Public
 */
router.post('/quotes/from-conversation/:conversationId', quoteManagementController.createQuoteFromConversation);

/**
 * @route POST /api/quote-management/quotes/:id/windows
 * @description Add a window to a quote
 * @access Public
 */
router.post('/quotes/:id/windows', quoteManagementController.addWindowToQuote);

/**
 * @route PUT /api/quote-management/windows/:windowId
 * @description Update a window
 * @access Public
 */
router.put('/windows/:windowId', quoteManagementController.updateWindow);

/**
 * @route DELETE /api/quote-management/windows/:windowId
 * @description Remove a window from a quote
 * @access Public
 */
router.delete('/windows/:windowId', quoteManagementController.removeWindow);

/**
 * @route POST /api/quote-management/quotes/:id/complete
 * @description Complete a quote
 * @access Public
 */
router.post('/quotes/:id/complete', quoteManagementController.completeQuote);

/**
 * @route GET /api/quote-management/quotes/:id/file
 * @description Generate and get the quote file
 * @access Public
 */
router.get('/quotes/:id/file', quoteManagementController.getQuoteFile);

module.exports = router;