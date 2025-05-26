/**
 * Multi-Window Quote Service
 * Enhanced service to handle quotes with multiple windows
 */

const quoteService = require('./quoteService');
const quoteModel = require('../models/quoteModel');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class MultiWindowQuoteService {
  constructor() {
    // Reference to the original quoteService for pricing calculations
    this.quoteService = quoteService;
  }
  
  /**
   * Create a new quote
   * @param {Object} quoteData - Basic quote information
   * @returns {Promise<Object>} - Created quote
   */
  async createQuote(quoteData) {
    try {
      // Set default status if not provided
      if (!quoteData.status) {
        quoteData.status = 'draft';
      }
      
      // Set expiration date if not provided (30 days from now)
      if (!quoteData.expires_at) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        quoteData.expires_at = expiryDate.toISOString();
      }
      
      // Create the quote in the database
      const quote = await quoteModel.createQuote(quoteData);
      
      logger.info('Created new quote', { quote_id: quote.id });
      return quote;
    } catch (error) {
      logger.error('Error creating quote:', error);
      throw new Error(`Failed to create quote: ${error.message}`);
    }
  }
  
  /**
   * Update an existing quote
   * @param {number} quoteId - Quote ID
   * @param {Object} quoteData - Updated quote data
   * @returns {Promise<Object>} - Updated quote
   */
  async updateQuote(quoteId, quoteData) {
    try {
      // Update the quote
      await quoteModel.updateQuote(quoteId, quoteData);
      
      // Return the updated quote
      const updatedQuote = await quoteModel.getQuoteById(quoteId);
      
      if (!updatedQuote) {
        throw new Error('Quote not found after update');
      }
      
      logger.info(`Updated quote ${quoteId}`);
      return updatedQuote;
    } catch (error) {
      logger.error(`Error updating quote ${quoteId}:`, error);
      throw new Error(`Failed to update quote: ${error.message}`);
    }
  }
  
  /**
   * Add a window to a quote
   * @param {number} quoteId - Quote ID
   * @param {Object} windowSpecs - Window specifications
   * @returns {Promise<Object>} - Added window
   */
  async addWindowToQuote(quoteId, windowSpecs) {
    try {
      // Verify quote exists
      const quote = await quoteModel.getQuoteById(quoteId);
      if (!quote) {
        throw new Error(`Quote ${quoteId} not found`);
      }
      
      // If status is complete, change to revision
      if (quote.status === 'complete') {
        await quoteModel.updateQuote(quoteId, {
          status: 'revision',
          statusNotes: 'Modified by adding a new window'
        });
      }
      
      // Calculate window pricing using the original quoteService
      const pricingResult = this.quoteService.calculateDetailedQuote({
        width: windowSpecs.width,
        height: windowSpecs.height,
        type: windowSpecs.type || 'standard',
        operationType: windowSpecs.operation_type || 'Hung',
        paneCount: windowSpecs.pane_count || 2,
        options: {
          lowE: windowSpecs.has_low_e,
          grilles: windowSpecs.has_grilles,
          glassType: windowSpecs.glass_type || 'clear'
        },
        quantity: windowSpecs.quantity || 1,
        sidingArea: windowSpecs.bay_siding_area || 0
      });
      
      if (pricingResult.error) {
        throw new Error(`Failed to calculate window pricing: ${pricingResult.message}`);
      }
      
      // Prepare window data for database
      const windowData = {
        location: windowSpecs.location,
        width: windowSpecs.width,
        height: windowSpecs.height,
        square_footage: pricingResult.window.dimensions.squareFootage,
        type: windowSpecs.type || 'standard',
        operation_type: windowSpecs.operation_type || 'Hung',
        pane_count: windowSpecs.pane_count || 2,
        glass_type: windowSpecs.glass_type || 'clear',
        has_low_e: !!windowSpecs.has_low_e,
        has_grilles: !!windowSpecs.has_grilles,
        has_interior_color: !!windowSpecs.has_interior_color,
        has_exterior_color: !!windowSpecs.has_exterior_color,
        quantity: windowSpecs.quantity || 1,
        base_price: pricingResult.pricing.basePrice,
        options_price: Object.values(pricingResult.pricing.optionsPrice).reduce((a, b) => a + b, 0),
        window_subtotal: pricingResult.pricing.windowSubtotal,
        installation_price: pricingResult.pricing.installationCost,
        display_order: windowSpecs.display_order || 0,
        note: windowSpecs.note
      };
      
      // Add bay window specific costs if applicable
      if (windowSpecs.type === 'bay') {
        windowData.bay_header_footer_cost = pricingResult.pricing.bayWindowCost?.headerFooter || 0;
        windowData.bay_siding_area = windowSpecs.bay_siding_area || 0;
        windowData.bay_siding_cost = pricingResult.pricing.bayWindowCost?.siding || 0;
      }
      
      // Add shaped window cost if applicable
      if (windowSpecs.type === 'shaped') {
        windowData.shaped_window_cost = pricingResult.pricing.shapedWindowCost || 0;
      }
      
      // Add window to the quote
      const addedWindow = await quoteModel.addWindowToQuote(quoteId, windowData);
      
      // Generate updated quote file
      await this.generateQuoteFile(quoteId);
      
      logger.info(`Added window to quote ${quoteId}`, { window_id: addedWindow.window_id });
      return addedWindow;
    } catch (error) {
      logger.error(`Error adding window to quote ${quoteId}:`, error);
      throw new Error(`Failed to add window to quote: ${error.message}`);
    }
  }
  
  /**
   * Get a complete quote by ID
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Object>} - Quote with windows
   */
  async getQuoteById(quoteId) {
    try {
      const quote = await quoteModel.getQuoteById(quoteId);
      
      if (!quote) {
        throw new Error(`Quote ${quoteId} not found`);
      }
      
      return quote;
    } catch (error) {
      logger.error(`Error getting quote ${quoteId}:`, error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }
  
  /**
   * Update a window in a quote
   * @param {number} windowId - Window ID
   * @param {Object} windowSpecs - Updated window specifications
   * @returns {Promise<Object>} - Updated window
   */
  async updateWindow(windowId, windowSpecs) {
    try {
      // Get current window data to get the quote ID
      const quote = await this.getQuoteByWindowId(windowId);
      
      if (!quote) {
        throw new Error(`Window ${windowId} not found`);
      }
      
      const quoteId = quote.id;
      
      // If status is complete, change to revision
      if (quote.status === 'complete') {
        await quoteModel.updateQuote(quoteId, {
          status: 'revision',
          statusNotes: 'Modified by updating a window'
        });
      }
      
      // Find the current window
      const currentWindow = quote.windows.find(w => w.window_id === windowId);
      
      if (!currentWindow) {
        throw new Error(`Window ${windowId} not found in quote ${quoteId}`);
      }
      
      // Merge current and new specs
      const mergedSpecs = {
        ...currentWindow,
        ...windowSpecs
      };
      
      // Calculate updated window pricing
      const pricingResult = this.quoteService.calculateDetailedQuote({
        width: mergedSpecs.width,
        height: mergedSpecs.height,
        type: mergedSpecs.type || 'standard',
        operationType: mergedSpecs.operation_type || 'Hung',
        paneCount: mergedSpecs.pane_count || 2,
        options: {
          lowE: mergedSpecs.has_low_e,
          grilles: mergedSpecs.has_grilles,
          glassType: mergedSpecs.glass_type || 'clear'
        },
        quantity: mergedSpecs.quantity || 1,
        sidingArea: mergedSpecs.bay_siding_area || 0
      });
      
      if (pricingResult.error) {
        throw new Error(`Failed to calculate window pricing: ${pricingResult.message}`);
      }
      
      // Prepare window data for database update
      const windowData = {
        location: mergedSpecs.location,
        width: mergedSpecs.width,
        height: mergedSpecs.height,
        square_footage: pricingResult.window.dimensions.squareFootage,
        type: mergedSpecs.type,
        operation_type: mergedSpecs.operation_type,
        pane_count: mergedSpecs.pane_count,
        glass_type: mergedSpecs.glass_type,
        has_low_e: !!mergedSpecs.has_low_e,
        has_grilles: !!mergedSpecs.has_grilles,
        has_interior_color: !!mergedSpecs.has_interior_color,
        has_exterior_color: !!mergedSpecs.has_exterior_color,
        quantity: mergedSpecs.quantity,
        base_price: pricingResult.pricing.basePrice,
        options_price: Object.values(pricingResult.pricing.optionsPrice).reduce((a, b) => a + b, 0),
        window_subtotal: pricingResult.pricing.windowSubtotal,
        installation_price: pricingResult.pricing.installationCost,
        display_order: mergedSpecs.display_order,
        note: mergedSpecs.note
      };
      
      // Add bay window specific costs if applicable
      if (mergedSpecs.type === 'bay') {
        windowData.bay_header_footer_cost = pricingResult.pricing.bayWindowCost?.headerFooter || 0;
        windowData.bay_siding_area = mergedSpecs.bay_siding_area || 0;
        windowData.bay_siding_cost = pricingResult.pricing.bayWindowCost?.siding || 0;
      } else {
        windowData.bay_header_footer_cost = null;
        windowData.bay_siding_area = null;
        windowData.bay_siding_cost = null;
      }
      
      // Add shaped window cost if applicable
      if (mergedSpecs.type === 'shaped') {
        windowData.shaped_window_cost = pricingResult.pricing.shapedWindowCost || 0;
      } else {
        windowData.shaped_window_cost = null;
      }
      
      // Update the window
      await quoteModel.updateWindow(windowId, windowData);
      
      // Get the updated window data
      const updatedQuote = await quoteModel.getQuoteById(quoteId);
      const updatedWindow = updatedQuote.windows.find(w => w.window_id === windowId);
      
      // Generate updated quote file
      await this.generateQuoteFile(quoteId);
      
      logger.info(`Updated window ${windowId} in quote ${quoteId}`);
      return updatedWindow;
    } catch (error) {
      logger.error(`Error updating window ${windowId}:`, error);
      throw new Error(`Failed to update window: ${error.message}`);
    }
  }
  
  /**
   * Get a quote by a window ID
   * @param {number} windowId - Window ID
   * @returns {Promise<Object>} - Quote containing the window
   */
  async getQuoteByWindowId(windowId) {
    try {
      const db = await require('../utils/database').getConnection();
      
      // Get the quote ID for this window
      const quoteId = await new Promise((resolve, reject) => {
        db.get('SELECT quote_id FROM quote_windows WHERE window_id = ?', [windowId], (err, row) => {
          db.close();
          if (err) reject(err);
          else resolve(row ? row.quote_id : null);
        });
      });
      
      if (!quoteId) {
        return null;
      }
      
      // Get the full quote
      return await quoteModel.getQuoteById(quoteId);
    } catch (error) {
      logger.error(`Error getting quote for window ${windowId}:`, error);
      throw new Error(`Failed to get quote for window: ${error.message}`);
    }
  }
  
  /**
   * Remove a window from a quote
   * @param {number} windowId - Window ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeWindow(windowId) {
    try {
      // Get the quote for this window
      const quote = await this.getQuoteByWindowId(windowId);
      
      if (!quote) {
        throw new Error(`Window ${windowId} not found`);
      }
      
      const quoteId = quote.id;
      
      // If status is complete, change to revision
      if (quote.status === 'complete') {
        await quoteModel.updateQuote(quoteId, {
          status: 'revision',
          statusNotes: 'Modified by removing a window'
        });
      }
      
      // Remove the window
      await quoteModel.removeWindow(windowId);
      
      // Generate updated quote file
      await this.generateQuoteFile(quoteId);
      
      logger.info(`Removed window ${windowId} from quote ${quoteId}`);
      return true;
    } catch (error) {
      logger.error(`Error removing window ${windowId}:`, error);
      throw new Error(`Failed to remove window: ${error.message}`);
    }
  }
  
  /**
   * Complete a quote (finalize it)
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Object>} - Completed quote
   */
  async completeQuote(quoteId) {
    try {
      const quote = await quoteModel.getQuoteById(quoteId);
      
      if (!quote) {
        throw new Error(`Quote ${quoteId} not found`);
      }
      
      // Check if quote has windows
      if (!quote.windows || quote.windows.length === 0) {
        throw new Error('Cannot complete a quote with no windows');
      }
      
      // Update quote status
      await quoteModel.updateQuote(quoteId, {
        status: 'complete',
        statusNotes: 'Quote finalized'
      });
      
      // Generate final quote file
      const fileResult = await this.generateQuoteFile(quoteId);
      
      // Get updated quote
      const completedQuote = await quoteModel.getQuoteById(quoteId);
      completedQuote.file_url = fileResult.url;
      
      logger.info(`Completed quote ${quoteId}`);
      return completedQuote;
    } catch (error) {
      logger.error(`Error completing quote ${quoteId}:`, error);
      throw new Error(`Failed to complete quote: ${error.message}`);
    }
  }
  
  /**
   * Generate HTML quote file
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Object>} - Result with file information
   */
  async generateQuoteFile(quoteId) {
    try {
      const quote = await quoteModel.getQuoteById(quoteId);
      
      if (!quote) {
        throw new Error(`Quote ${quoteId} not found`);
      }
      
      if (!quote.windows || quote.windows.length === 0) {
        throw new Error('Cannot generate file for a quote with no windows');
      }
      
      // Generate unique filename
      const timestamp = new Date().getTime();
      const filename = `quote_${quoteId}_${timestamp}.html`;
      
      // Create quotes directory if it doesn't exist
      const quotesDir = path.join(process.cwd(), 'public', 'quotes');
      if (!fs.existsSync(quotesDir)) {
        fs.mkdirSync(quotesDir, { recursive: true });
      }
      
      // Generate HTML
      const html = this.generateMultiWindowQuoteHTML(quote);
      
      // Write file
      const filePath = path.join(quotesDir, filename);
      fs.writeFileSync(filePath, html);
      
      // Calculate relative URL path
      const fileUrl = `/quotes/${filename}`;
      
      // Save file record in database
      await quoteModel.addQuoteFile(quoteId, 'html', filePath, fileUrl);
      
      logger.debug('Generated quote file', { quote_id: quoteId, path: filePath, url: fileUrl });
      
      return {
        success: true,
        path: filePath,
        url: fileUrl,
        quote_id: quoteId
      };
    } catch (error) {
      logger.error(`Error generating quote file for ${quoteId}:`, error);
      throw new Error(`Failed to generate quote file: ${error.message}`);
    }
  }
  
  /**
   * Generate HTML for a multi-window quote
   * @param {Object} quote - Quote data with windows
   * @returns {string} - HTML representation of the quote
   */
  generateMultiWindowQuoteHTML(quote) {
    try {
      // Format prices
      const formatPrice = (price) => `$${price.toFixed(2)}`;
      
      // Calculate grand total
      let grandTotal = quote.total_amount || 0;
      
      // Start HTML content
      let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Window Quote #${quote.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1, h2, h3 {
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
          .window-card {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
            background-color: #f9f9f9;
          }
          .window-header {
            background-color: #0066cc;
            color: white;
            padding: 8px 15px;
            border-radius: 5px 5px 0 0;
            margin: -15px -15px 15px -15px;
          }
          .summary-section {
            background-color: #f0f7ff;
            border: 1px solid #cce5ff;
            border-radius: 5px;
            padding: 15px;
            margin-top: 30px;
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
          .quote-meta {
            display: flex;
            justify-content: space-between;
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .quote-meta-col {
            flex: 1;
          }
        </style>
      </head>
      <body>
        <div class="logo">
          <h1>Window Quote #${quote.id}</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="quote-meta">
          <div class="quote-meta-col">
            <strong>Customer:</strong> ${quote.customer_name || 'N/A'}<br>
            <strong>Phone:</strong> ${quote.customer_id || 'N/A'}<br>
            <strong>Email:</strong> ${quote.customer_email || 'N/A'}
          </div>
          <div class="quote-meta-col">
            <strong>Quote Status:</strong> ${quote.status.toUpperCase()}<br>
            <strong>Created:</strong> ${new Date(quote.created_at).toLocaleDateString()}<br>
            <strong>Expires:</strong> ${quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        
        <div class="section">
          <h2>Project Details</h2>
          <p>${quote.description || 'No description provided.'}</p>
        </div>
      `;
      
      // Add window details
      html += `<h2>Windows (${quote.windows.length})</h2>`;
      
      // Loop through each window
      for (const window of quote.windows) {
        const locationText = window.location ? `${window.location}` : '';
        
        html += `
        <div class="window-card">
          <div class="window-header">
            <h3>${window.type.charAt(0).toUpperCase() + window.type.slice(1)} ${window.operation_type} Window ${locationText ? '- ' + locationText : ''}</h3>
          </div>
          
          <div class="section">
            <div class="spec-row">
              <span>Dimensions:</span>
              <span>${window.width}" × ${window.height}" (${window.square_footage} sq ft)</span>
            </div>
            <div class="spec-row">
              <span>Glass Type:</span>
              <span>${window.glass_type.charAt(0).toUpperCase() + window.glass_type.slice(1)}</span>
            </div>
            <div class="spec-row">
              <span>Pane Count:</span>
              <span>${window.pane_count === 3 ? 'Triple Pane' : window.pane_count === 1 ? 'Single Pane' : 'Double Pane'}</span>
            </div>
            <div class="spec-row">
              <span>Low-E Glass:</span>
              <span>${window.has_low_e ? 'Yes' : 'No'}</span>
            </div>
            <div class="spec-row">
              <span>Grilles:</span>
              <span>${window.has_grilles ? 'Yes' : 'No'}</span>
            </div>
            <div class="spec-row">
              <span>Interior Color:</span>
              <span>${window.has_interior_color ? 'Non-White' : 'White (Standard)'}</span>
            </div>
            <div class="spec-row">
              <span>Exterior Color:</span>
              <span>${window.has_exterior_color ? 'Non-White' : 'White (Standard)'}</span>
            </div>
            <div class="spec-row">
              <span>Quantity:</span>
              <span>${window.quantity}</span>
            </div>
            ${window.note ? `<div class="spec-row">
              <span>Notes:</span>
              <span>${window.note}</span>
            </div>` : ''}
          </div>
          
          <div class="section">
            <h4>Price Breakdown</h4>
            <div class="price-row">
              <span>Base Price:</span>
              <span>${formatPrice(window.base_price)}</span>
            </div>
            ${window.shaped_window_cost ? `
            <div class="price-row">
              <span>Shaped Window Top:</span>
              <span>${formatPrice(window.shaped_window_cost)}</span>
            </div>` : ''}
            ${window.bay_header_footer_cost ? `
            <div class="price-row">
              <span>Bay Window Header/Footer:</span>
              <span>${formatPrice(window.bay_header_footer_cost)}</span>
            </div>` : ''}
            ${window.bay_siding_cost ? `
            <div class="price-row">
              <span>Bay Window Siding:</span>
              <span>${formatPrice(window.bay_siding_cost)}</span>
            </div>` : ''}
            ${window.options_price > 0 ? `
            <div class="price-row">
              <span>Options:</span>
              <span>${formatPrice(window.options_price)}</span>
            </div>` : ''}
            <div class="price-row">
              <span>Window Price (each):</span>
              <span>${formatPrice(window.window_subtotal)}</span>
            </div>
            <div class="price-row">
              <span>Quantity:</span>
              <span>× ${window.quantity}</span>
            </div>
            <div class="price-row">
              <span>Installation:</span>
              <span>${formatPrice(window.installation_price)}</span>
            </div>
            <div class="price-row total-row">
              <span>Total for this window:</span>
              <span>${formatPrice(window.window_subtotal * window.quantity + window.installation_price)}</span>
            </div>
          </div>
        </div>
        `;
      }
      
      // Add quote summary section
      html += `
      <div class="summary-section">
        <h2>Quote Summary</h2>
        <div class="price-row">
          <span>Windows Subtotal:</span>
          <span>${formatPrice(grandTotal)}</span>
        </div>
        ${quote.discount_rate > 0 ? `
        <div class="price-row">
          <span>Additional Discount (${(quote.discount_rate * 100).toFixed(2)}%):</span>
          <span>-${formatPrice(grandTotal * quote.discount_rate)}</span>
        </div>
        <div class="price-row">
          <span>After Discount:</span>
          <span>${formatPrice(grandTotal * (1 - quote.discount_rate))}</span>
        </div>` : ''}
        ${quote.tax_rate > 0 ? `
        <div class="price-row">
          <span>Tax (${(quote.tax_rate * 100).toFixed(2)}%):</span>
          <span>${formatPrice(grandTotal * (1 - quote.discount_rate) * quote.tax_rate)}</span>
        </div>` : ''}
        <div class="price-row total-row">
          <span>Grand Total:</span>
          <span>${formatPrice(grandTotal * (1 - quote.discount_rate) * (1 + quote.tax_rate))}</span>
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
      logger.error('Error generating multi-window quote HTML:', error);
      return '<h1>Error generating quote</h1><p>An error occurred while generating the quote details.</p>';
    }
  }
  
  /**
   * Create a quote from a conversation
   * @param {number} conversationId - Conversation ID
   * @param {string} customerId - Customer ID (phone number)
   * @param {string} customerName - Customer name
   * @returns {Promise<Object>} - Created quote
   */
  async createQuoteFromConversation(conversationId, customerId, customerName) {
    try {
      // Verify if we have window specifications for this conversation
      const db = await require('../utils/database').getConnection();
      
      const windowSpecs = await new Promise((resolve, reject) => {
        const sql = `SELECT * FROM window_specifications WHERE conversation_id = ? ORDER BY timestamp DESC`;
        
        db.all(sql, [conversationId], (err, rows) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      
      if (!windowSpecs || windowSpecs.length === 0) {
        throw new Error('No window specifications found for this conversation');
      }
      
      // Create a new quote
      const quote = await this.createQuote({
        conversation_id: conversationId,
        customer_id: customerId,
        customer_name: customerName,
        description: `Quote from conversation #${conversationId}`,
        status: 'draft'
      });
      
      // Process each window specification and add to quote
      for (const spec of windowSpecs) {
        // Parse features if present
        let features = [];
        try {
          features = JSON.parse(spec.features || '[]');
        } catch (e) {
          logger.warn(`Failed to parse features for window spec ${spec.id}`);
        }
        
        // Prepare window data
        const windowData = {
          location: spec.location,
          width: spec.width,
          height: spec.height,
          type: (spec.window_type || 'standard').toLowerCase(),
          operation_type: 'Hung', // Default
          pane_count: spec.glass_type?.includes('Triple') ? 3 : 2,
          glass_type: 'clear', // Default
          has_low_e: features.some(f => f.includes('Low-E')),
          has_grilles: features.some(f => f.includes('Grilles')),
          has_interior_color: false, // Default
          has_exterior_color: false, // Default
          quantity: 1
        };
        
        // Add window to quote
        await this.addWindowToQuote(quote.id, windowData);
      }
      
      // Get the updated quote with windows
      const completeQuote = await this.getQuoteById(quote.id);
      
      logger.info(`Created quote from conversation ${conversationId}`, { quote_id: quote.id });
      return completeQuote;
    } catch (error) {
      logger.error(`Error creating quote from conversation ${conversationId}:`, error);
      throw new Error(`Failed to create quote from conversation: ${error.message}`);
    }
  }
  
  /**
   * Find recent quotes
   * @param {number} limit - Maximum number of quotes to return
   * @returns {Promise<Array>} - Recent quotes
   */
  async findRecentQuotes(limit = 10) {
    try {
      return await quoteModel.findRecentQuotes(limit);
    } catch (error) {
      logger.error('Error finding recent quotes:', error);
      throw new Error(`Failed to find recent quotes: ${error.message}`);
    }
  }
}

module.exports = new MultiWindowQuoteService();