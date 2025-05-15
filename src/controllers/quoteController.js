const quoteService = require('../services/quoteService');
const quoteDetailService = require('../services/quoteDetailService');
const messageParser = require('../utils/messageParser');
const windowSpecParser = require('../utils/windowSpecParser');
const logger = require('../utils/logger');

class QuoteController {
  /**
   * Generate a window quote based on a text message
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  generateQuote(req, res) {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Extract information from message
      const dimensions = messageParser.extractDimensions(message);
      const windowType = messageParser.extractWindowType(message) || 'standard';
      const paneCount = messageParser.extractPaneCount(message);
      const options = messageParser.extractOptions(message);
      
      if (!dimensions) {
        return res.status(400).json({ 
          error: 'Could not extract window dimensions from message',
          requiredFormat: 'Please provide dimensions in format: width x height (in inches)'
        });
      }
      
      // For backward compatibility, use the legacy method
      const quote = quoteService.calculateEstimate(
        dimensions.width,
        dimensions.height,
        windowType,
        paneCount,
        options
      );
      
      if (!quote) {
        return res.status(400).json({ error: 'Could not calculate quote' });
      }
      
      return res.status(200).json({ 
        dimensions,
        windowType,
        paneCount,
        options,
        quote
      });
    } catch (error) {
      logger.error('Error generating quote:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Generate a detailed window quote based on structured specifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  generateDetailedQuote(req, res) {
    try {
      const { 
        width, 
        height, 
        type, 
        operationType, 
        paneCount, 
        options,
        quantity,
        sidingArea 
      } = req.body;
      
      // Validate required parameters
      if (!width || !height) {
        return res.status(400).json({ 
          error: 'Width and height are required',
          requiredFields: ['width', 'height'] 
        });
      }
      
      // Calculate detailed quote
      const quoteResult = quoteService.calculateDetailedQuote({
        width,
        height,
        type: type || 'standard',
        operationType: operationType || 'Hung',
        paneCount: paneCount || 2,
        options: options || {},
        quantity: quantity || 1,
        sidingArea: sidingArea || 0
      });
      
      // Check for errors
      if (quoteResult.error) {
        return res.status(400).json(quoteResult);
      }
      
      return res.status(200).json(quoteResult);
    } catch (error) {
      logger.error('Error generating detailed quote:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Generate a quote based on conversation messages
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  generateQuoteFromConversation(req, res) {
    try {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Valid conversation messages are required' });
      }
      
      // Extract specifications from conversation
      const specs = windowSpecParser.parseWindowSpecifications(messages);
      
      // Check if we have enough information for a quote
      if (!specs.is_complete) {
        return res.status(400).json({ 
          error: 'Incomplete window specifications',
          missingFields: Object.keys(specs).filter(key => !specs[key] && key !== 'is_complete')
        });
      }
      
      // Use extracted specifications to generate a quote
      const quoteResult = quoteService.calculateDetailedQuote({
        width: specs.width,
        height: specs.height,
        type: specs.window_type.toLowerCase(),
        operationType: 'Hung', // Default operation type
        paneCount: specs.glass_type?.includes('Triple') ? 3 : 2,
        options: {
          lowE: specs.features.some(f => f.includes('Low-E')),
          grilles: specs.features.some(f => f.includes('Grilles'))
        },
        quantity: 1
      });
      
      if (quoteResult.error) {
        return res.status(400).json(quoteResult);
      }
      
      // Return a combined result with specifications and quote
      return res.status(200).json({
        specifications: specs,
        quote: quoteResult
      });
    } catch (error) {
      logger.error('Error generating quote from conversation:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Get or generate a detailed quote as HTML
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getQuoteDetails(req, res) {
    try {
      // Get quote result from parameters
      const result = quoteDetailService.getQuoteByParams(req.query);
      
      if (result.error) {
        return res.status(400).json(result);
      }
      
      // Redirect to the generated quote file
      return res.redirect(result.url);
    } catch (error) {
      logger.error('Error getting quote details:', error);
      return res.status(500).json({ error: 'Failed to get quote details' });
    }
  }
  
  /**
   * Generate a sample quote for demonstration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getSampleQuote(req, res) {
    try {
      // Generate a sample quote
      const sampleSpecs = {
        width: 36,
        height: 48,
        type: 'standard',
        operationType: 'Hung',
        paneCount: 2,
        options: {
          lowE: true,
          grilles: true,
          glassType: 'clear'
        },
        quantity: 1
      };
      
      const quote = quoteService.calculateDetailedQuote(sampleSpecs);
      
      return res.status(200).json(quote);
    } catch (error) {
      logger.error('Error generating sample quote:', error);
      return res.status(500).json({ error: 'Failed to generate sample quote' });
    }
  }
}

module.exports = new QuoteController();