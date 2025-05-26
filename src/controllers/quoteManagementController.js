/**
 * Quote Management Controller
 * Handles multi-window quote management operations
 */

const multiWindowQuoteService = require('../services/multiWindowQuoteService');
const quoteModel = require('../models/quoteModel');
const logger = require('../utils/logger');

class QuoteManagementController {
  /**
   * Create a new quote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createQuote(req, res) {
    try {
      const quoteData = req.body;
      
      if (!quoteData) {
        return res.status(400).json({ error: 'Quote data is required' });
      }
      
      const quote = await multiWindowQuoteService.createQuote(quoteData);
      
      return res.status(201).json({
        success: true,
        message: 'Quote created successfully',
        quote
      });
    } catch (error) {
      logger.error('Error creating quote:', error);
      return res.status(500).json({ error: 'Failed to create quote', message: error.message });
    }
  }
  
  /**
   * Get a quote by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getQuote(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Quote ID is required' });
      }
      
      const quote = await multiWindowQuoteService.getQuoteById(Number(id));
      
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      return res.status(200).json({
        success: true,
        quote
      });
    } catch (error) {
      logger.error(`Error getting quote ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to get quote', message: error.message });
    }
  }
  
  /**
   * Update a quote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateQuote(req, res) {
    try {
      const { id } = req.params;
      const quoteData = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Quote ID is required' });
      }
      
      if (!quoteData) {
        return res.status(400).json({ error: 'Quote data is required' });
      }
      
      const updatedQuote = await multiWindowQuoteService.updateQuote(Number(id), quoteData);
      
      return res.status(200).json({
        success: true,
        message: 'Quote updated successfully',
        quote: updatedQuote
      });
    } catch (error) {
      logger.error(`Error updating quote ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to update quote', message: error.message });
    }
  }
  
  /**
   * Delete a quote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteQuote(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Quote ID is required' });
      }
      
      const result = await quoteModel.deleteQuote(Number(id));
      
      if (!result) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Quote deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting quote ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to delete quote', message: error.message });
    }
  }
  
  /**
   * Get recent quotes
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRecentQuotes(req, res) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      
      const quotes = await multiWindowQuoteService.findRecentQuotes(limit);
      
      return res.status(200).json({
        success: true,
        quotes
      });
    } catch (error) {
      logger.error('Error getting recent quotes:', error);
      return res.status(500).json({ error: 'Failed to get recent quotes', message: error.message });
    }
  }
  
  /**
   * Get quotes by customer ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getQuotesByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
      
      const quotes = await quoteModel.getQuotesByCustomerId(customerId);
      
      return res.status(200).json({
        success: true,
        quotes
      });
    } catch (error) {
      logger.error(`Error getting quotes for customer ${req.params.customerId}:`, error);
      return res.status(500).json({ error: 'Failed to get quotes', message: error.message });
    }
  }
  
  /**
   * Get quotes by conversation ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getQuotesByConversation(req, res) {
    try {
      const { conversationId } = req.params;
      
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }
      
      const quotes = await quoteModel.getQuotesByConversationId(Number(conversationId));
      
      return res.status(200).json({
        success: true,
        quotes
      });
    } catch (error) {
      logger.error(`Error getting quotes for conversation ${req.params.conversationId}:`, error);
      return res.status(500).json({ error: 'Failed to get quotes', message: error.message });
    }
  }
  
  /**
   * Create a quote from a conversation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createQuoteFromConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { customerId, customerName } = req.body;
      
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }
      
      const quote = await multiWindowQuoteService.createQuoteFromConversation(
        Number(conversationId),
        customerId,
        customerName
      );
      
      return res.status(201).json({
        success: true,
        message: 'Quote created from conversation successfully',
        quote
      });
    } catch (error) {
      logger.error(`Error creating quote from conversation ${req.params.conversationId}:`, error);
      return res.status(500).json({ error: 'Failed to create quote from conversation', message: error.message });
    }
  }
  
  /**
   * Add a window to a quote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addWindowToQuote(req, res) {
    try {
      const { id } = req.params;
      const windowSpecs = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Quote ID is required' });
      }
      
      if (!windowSpecs) {
        return res.status(400).json({ error: 'Window specifications are required' });
      }
      
      if (!windowSpecs.width || !windowSpecs.height) {
        return res.status(400).json({ error: 'Window width and height are required' });
      }
      
      const addedWindow = await multiWindowQuoteService.addWindowToQuote(Number(id), windowSpecs);
      
      return res.status(201).json({
        success: true,
        message: 'Window added to quote successfully',
        window: addedWindow
      });
    } catch (error) {
      logger.error(`Error adding window to quote ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to add window to quote', message: error.message });
    }
  }
  
  /**
   * Update a window
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateWindow(req, res) {
    try {
      const { windowId } = req.params;
      const windowSpecs = req.body;
      
      if (!windowId) {
        return res.status(400).json({ error: 'Window ID is required' });
      }
      
      if (!windowSpecs) {
        return res.status(400).json({ error: 'Window specifications are required' });
      }
      
      const updatedWindow = await multiWindowQuoteService.updateWindow(Number(windowId), windowSpecs);
      
      return res.status(200).json({
        success: true,
        message: 'Window updated successfully',
        window: updatedWindow
      });
    } catch (error) {
      logger.error(`Error updating window ${req.params.windowId}:`, error);
      return res.status(500).json({ error: 'Failed to update window', message: error.message });
    }
  }
  
  /**
   * Remove a window from a quote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async removeWindow(req, res) {
    try {
      const { windowId } = req.params;
      
      if (!windowId) {
        return res.status(400).json({ error: 'Window ID is required' });
      }
      
      const result = await multiWindowQuoteService.removeWindow(Number(windowId));
      
      return res.status(200).json({
        success: true,
        message: 'Window removed from quote successfully'
      });
    } catch (error) {
      logger.error(`Error removing window ${req.params.windowId}:`, error);
      return res.status(500).json({ error: 'Failed to remove window', message: error.message });
    }
  }
  
  /**
   * Complete a quote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async completeQuote(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Quote ID is required' });
      }
      
      const completedQuote = await multiWindowQuoteService.completeQuote(Number(id));
      
      return res.status(200).json({
        success: true,
        message: 'Quote completed successfully',
        quote: completedQuote
      });
    } catch (error) {
      logger.error(`Error completing quote ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to complete quote', message: error.message });
    }
  }
  
  /**
   * Generate and get the quote file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getQuoteFile(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Quote ID is required' });
      }
      
      const fileResult = await multiWindowQuoteService.generateQuoteFile(Number(id));
      
      // Redirect to the file URL
      return res.redirect(fileResult.url);
    } catch (error) {
      logger.error(`Error getting quote file for ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to get quote file', message: error.message });
    }
  }
}

module.exports = new QuoteManagementController();