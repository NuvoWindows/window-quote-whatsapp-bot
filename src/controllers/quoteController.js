const quoteService = require('../services/quoteService');
const messageParser = require('../utils/messageParser');

class QuoteController {
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
      
      // Calculate quote
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
      console.error('Error generating quote:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new QuoteController();