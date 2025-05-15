/**
 * Quote Detail Service
 * Generates detailed quote information in various formats (JSON, HTML, PDF)
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const quoteService = require('./quoteService');

class QuoteDetailService {
  /**
   * Generate HTML for a detailed quote
   * @param {Object} quoteData - Quote data from quoteService
   * @returns {string} - HTML representation of the quote
   */
  generateQuoteHTML(quoteData) {
    try {
      const { window, pricing } = quoteData;
      
      // Calculate formatted prices
      const formatPrice = (price) => `$${price.toFixed(2)}`;
      
      // Create HTML template
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Window Quote Details</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1, h2 {
            color: #0066cc;
          }
          .section {
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
          }
          .spec-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .price-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .total-row {
            font-weight: bold;
            font-size: 1.2em;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
          }
          .notes {
            font-size: 0.9em;
            font-style: italic;
            margin-top: 30px;
            color: #666;
          }
          .logo {
            text-align: center;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="logo">
          <h1>Window Quote Details</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="section">
          <h2>Window Specifications</h2>
          <div class="spec-row">
            <span>Dimensions:</span>
            <span>${window.dimensions.width}" × ${window.dimensions.height}" (${window.dimensions.squareFootage} sq ft)</span>
          </div>
          <div class="spec-row">
            <span>Window Type:</span>
            <span>${window.type.charAt(0).toUpperCase() + window.type.slice(1)}</span>
          </div>
          <div class="spec-row">
            <span>Operation Type:</span>
            <span>${window.operationType}</span>
          </div>
          <div class="spec-row">
            <span>Glass Type:</span>
            <span>${window.options.glassType.charAt(0).toUpperCase() + window.options.glassType.slice(1)}</span>
          </div>
          <div class="spec-row">
            <span>Pane Count:</span>
            <span>${window.paneCount === 3 ? 'Triple Pane' : window.paneCount === 1 ? 'Single Pane' : 'Double Pane'}</span>
          </div>
          <div class="spec-row">
            <span>Low-E Glass:</span>
            <span>${window.options.lowE ? 'Yes' : 'No'}</span>
          </div>
          <div class="spec-row">
            <span>Grilles:</span>
            <span>${window.options.grilles ? 'Yes' : 'No'}</span>
          </div>
          <div class="spec-row">
            <span>Quantity:</span>
            <span>${window.quantity}</span>
          </div>
        </div>
        
        <div class="section">
          <h2>Price Breakdown</h2>
          <div class="price-row">
            <span>Base Price:</span>
            <span>${formatPrice(pricing.basePrice)}</span>
          </div>
          ${pricing.shapedWindowCost ? `
          <div class="price-row">
            <span>Shaped Window Top:</span>
            <span>${formatPrice(pricing.shapedWindowCost)}</span>
          </div>` : ''}
          ${pricing.bayWindowCost ? `
          <div class="price-row">
            <span>Bay Window Header/Footer:</span>
            <span>${formatPrice(pricing.bayWindowCost.headerFooter)}</span>
          </div>
          ${pricing.bayWindowCost.siding > 0 ? `
          <div class="price-row">
            <span>Bay Window Siding:</span>
            <span>${formatPrice(pricing.bayWindowCost.siding)}</span>
          </div>` : ''}` : ''}
          ${pricing.optionsPrice.glassType > 0 ? `
          <div class="price-row">
            <span>Glass Type Upgrade:</span>
            <span>${formatPrice(pricing.optionsPrice.glassType)}</span>
          </div>` : ''}
          ${pricing.optionsPrice.paneCount > 0 ? `
          <div class="price-row">
            <span>Triple Pane Upgrade:</span>
            <span>${formatPrice(pricing.optionsPrice.paneCount)}</span>
          </div>` : ''}
          ${pricing.optionsPrice.lowE > 0 ? `
          <div class="price-row">
            <span>Low-E with Argon:</span>
            <span>${formatPrice(pricing.optionsPrice.lowE)}</span>
          </div>` : ''}
          ${pricing.optionsPrice.grilles > 0 ? `
          <div class="price-row">
            <span>Grilles:</span>
            <span>${formatPrice(pricing.optionsPrice.grilles)}</span>
          </div>` : ''}
          <div class="price-row">
            <span>Window Subtotal:</span>
            <span>${formatPrice(pricing.windowSubtotal)}</span>
          </div>
          <div class="price-row">
            <span>Quantity:</span>
            <span>× ${window.quantity}</span>
          </div>
          <div class="price-row">
            <span>Subtotal:</span>
            <span>${formatPrice(pricing.subtotal)}</span>
          </div>
          ${pricing.discount > 0 ? `
          <div class="price-row">
            <span>Quantity Discount:</span>
            <span>-${formatPrice(pricing.discount)}</span>
          </div>` : ''}
          <div class="price-row">
            <span>Installation:</span>
            <span>${formatPrice(pricing.installationCost)}</span>
          </div>
          <div class="price-row total-row">
            <span>Total:</span>
            <span>${formatPrice(pricing.total)}</span>
          </div>
        </div>
        
        <div class="notes">
          <p>Note: This quote is valid for 30 days from the date of generation.</p>
          <p>Installation includes brick-to-brick installation method.</p>
          <p>Warranty: All windows come with a 10-year limited warranty.</p>
        </div>
      </body>
      </html>
      `;
      
      return html;
    } catch (error) {
      logger.error('Error generating quote HTML:', error);
      return '<h1>Error generating quote</h1><p>An error occurred while generating the quote details.</p>';
    }
  }
  
  /**
   * Generate and save HTML quote to a file
   * @param {Object} quoteSpecs - Quote specifications
   * @returns {Object} - Result with path to generated file
   */
  generateQuoteFile(quoteSpecs) {
    try {
      // Get quote data
      const quoteData = quoteService.calculateDetailedQuote(quoteSpecs);
      
      if (quoteData.error) {
        return { error: quoteData.error, message: quoteData.message };
      }
      
      // Generate HTML
      const html = this.generateQuoteHTML(quoteData);
      
      // Create quotes directory if it doesn't exist
      const quotesDir = path.join(process.cwd(), 'public', 'quotes');
      if (!fs.existsSync(quotesDir)) {
        fs.mkdirSync(quotesDir, { recursive: true });
      }
      
      // Generate unique filename
      const timestamp = new Date().getTime();
      const filename = `quote_${timestamp}.html`;
      const filePath = path.join(quotesDir, filename);
      
      // Write file
      fs.writeFileSync(filePath, html);
      
      // Calculate relative URL path
      const urlPath = `/quotes/${filename}`;
      
      logger.debug('Generated quote file', { path: filePath, url: urlPath });
      
      return {
        success: true,
        path: filePath,
        url: urlPath,
        quoteData
      };
    } catch (error) {
      logger.error('Error generating quote file:', error);
      return {
        error: 'Failed to generate quote file',
        message: error.message
      };
    }
  }
  
  /**
   * Get a quote by window specifications
   * @param {Object} params - URL parameters containing encoded window specs
   * @returns {Object} - Quote file information or error
   */
  getQuoteByParams(params) {
    try {
      // Parse window specs from parameters
      let windowSpecs;
      if (params.window) {
        windowSpecs = JSON.parse(decodeURIComponent(params.window));
      } else {
        return { error: 'No window specifications provided' };
      }
      
      // Generate quote file
      return this.generateQuoteFile(windowSpecs);
    } catch (error) {
      logger.error('Error parsing quote parameters:', error);
      return {
        error: 'Invalid quote parameters',
        message: error.message
      };
    }
  }
}

module.exports = new QuoteDetailService();