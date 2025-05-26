/**
 * Quote Model
 * Handles database operations for quotes and related entities
 */

const logger = require('../utils/logger');
const database = require('../utils/database');

class QuoteModel {
  /**
   * Create a new quote
   * @param {Object} quoteData - Quote data
   * @returns {Promise<Object>} - Created quote with ID
   */
  async createQuote(quoteData) {
    const db = await database.getConnection();
    
    try {
      const now = new Date().toISOString();
      
      // Insert quote record
      const result = await new Promise((resolve, reject) => {
        const params = {
          $conversation_id: quoteData.conversation_id || null,
          $customer_id: quoteData.customer_id || null,
          $customer_name: quoteData.customer_name || null,
          $customer_email: quoteData.customer_email || null,
          $description: quoteData.description || null,
          $status: quoteData.status || 'draft',
          $quote_version: quoteData.quote_version || 1,
          $discount_rate: quoteData.discount_rate || 0,
          $tax_rate: quoteData.tax_rate || 0.13,
          $total_amount: quoteData.total_amount || null,
          $sales_rep: quoteData.sales_rep || null,
          $created_at: now,
          $updated_at: now,
          $expires_at: quoteData.expires_at || null,
          $metadata: quoteData.metadata ? JSON.stringify(quoteData.metadata) : null
        };
        
        const sql = `
          INSERT INTO quotes (
            conversation_id, customer_id, customer_name, customer_email,
            description, status, quote_version, discount_rate, tax_rate,
            total_amount, sales_rep, created_at, updated_at, expires_at, metadata
          ) VALUES (
            $conversation_id, $customer_id, $customer_name, $customer_email,
            $description, $status, $quote_version, $discount_rate, $tax_rate,
            $total_amount, $sales_rep, $created_at, $updated_at, $expires_at, $metadata
          )
        `;
        
        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          // Return the created quote with ID
          resolve({
            id: this.lastID,
            ...quoteData,
            created_at: now,
            updated_at: now
          });
        });
      });
      
      // Add initial status history record
      await this.addStatusHistory(result.id, null, result.status, 'Initial quote creation');
      
      logger.debug('Created new quote', { quote_id: result.id });
      return result;
    } catch (error) {
      logger.error('Error creating quote:', error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get a quote by ID
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Object>} - Quote data
   */
  async getQuoteById(quoteId) {
    const db = await database.getConnection();
    
    try {
      // Get quote record
      const quote = await new Promise((resolve, reject) => {
        const sql = `SELECT * FROM quotes WHERE id = ?`;
        
        db.get(sql, [quoteId], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!row) {
            resolve(null);
            return;
          }
          
          // Parse JSON metadata if present
          if (row.metadata) {
            try {
              row.metadata = JSON.parse(row.metadata);
            } catch (e) {
              logger.warn(`Failed to parse metadata for quote ${quoteId}`);
            }
          }
          
          resolve(row);
        });
      });
      
      if (!quote) {
        return null;
      }
      
      // Get windows for this quote
      const windows = await this.getWindowsByQuoteId(quoteId);
      quote.windows = windows;
      
      return quote;
    } catch (error) {
      logger.error(`Error getting quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Update a quote
   * @param {number} quoteId - Quote ID
   * @param {Object} quoteData - Updated quote data
   * @returns {Promise<boolean>} - Success status
   */
  async updateQuote(quoteId, quoteData) {
    const db = await database.getConnection();
    
    try {
      const now = new Date().toISOString();
      
      // Track status change if needed
      const currentQuote = await this.getQuoteById(quoteId);
      if (currentQuote && quoteData.status && currentQuote.status !== quoteData.status) {
        await this.addStatusHistory(
          quoteId, 
          currentQuote.status, 
          quoteData.status,
          quoteData.statusNotes || 'Status updated'
        );
      }
      
      // Build update query dynamically based on provided fields
      const updateFields = [];
      const params = {};
      
      for (const [key, value] of Object.entries(quoteData)) {
        if (key !== 'id' && key !== 'created_at' && key !== 'statusNotes') {
          updateFields.push(`${key} = $${key}`);
          params[`$${key}`] = value === Object(value) ? JSON.stringify(value) : value;
        }
      }
      
      // Always update the updated_at timestamp
      updateFields.push('updated_at = $updated_at');
      params.$updated_at = now;
      params.$id = quoteId;
      
      // Execute update if there are fields to update
      if (updateFields.length > 0) {
        const sql = `UPDATE quotes SET ${updateFields.join(', ')} WHERE id = $id`;
        
        await new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.changes);
          });
        });
      }
      
      logger.debug(`Updated quote ${quoteId}`);
      return true;
    } catch (error) {
      logger.error(`Error updating quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Delete a quote
   * @param {number} quoteId - Quote ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteQuote(quoteId) {
    const db = await database.getConnection();
    
    try {
      // Delete quote (cascades to windows, status history, and files)
      const result = await new Promise((resolve, reject) => {
        const sql = `DELETE FROM quotes WHERE id = ?`;
        
        db.run(sql, [quoteId], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      });
      
      if (result) {
        logger.debug(`Deleted quote ${quoteId}`);
      } else {
        logger.warn(`Quote ${quoteId} not found for deletion`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error deleting quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get quotes by customer ID
   * @param {string} customerId - Customer ID (phone number)
   * @returns {Promise<Array>} - List of quotes
   */
  async getQuotesByCustomerId(customerId) {
    const db = await database.getConnection();
    
    try {
      const quotes = await new Promise((resolve, reject) => {
        const sql = `SELECT * FROM quotes WHERE customer_id = ? ORDER BY updated_at DESC`;
        
        db.all(sql, [customerId], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Parse JSON metadata for each quote
          for (const row of rows) {
            if (row.metadata) {
              try {
                row.metadata = JSON.parse(row.metadata);
              } catch (e) {
                logger.warn(`Failed to parse metadata for quote ${row.id}`);
              }
            }
          }
          
          resolve(rows);
        });
      });
      
      return quotes;
    } catch (error) {
      logger.error(`Error getting quotes for customer ${customerId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get quotes by conversation ID
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<Array>} - List of quotes
   */
  async getQuotesByConversationId(conversationId) {
    const db = await database.getConnection();
    
    try {
      const quotes = await new Promise((resolve, reject) => {
        const sql = `SELECT * FROM quotes WHERE conversation_id = ? ORDER BY updated_at DESC`;
        
        db.all(sql, [conversationId], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Parse JSON metadata for each quote
          for (const row of rows) {
            if (row.metadata) {
              try {
                row.metadata = JSON.parse(row.metadata);
              } catch (e) {
                logger.warn(`Failed to parse metadata for quote ${row.id}`);
              }
            }
          }
          
          resolve(rows);
        });
      });
      
      return quotes;
    } catch (error) {
      logger.error(`Error getting quotes for conversation ${conversationId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Add a window to a quote
   * @param {number} quoteId - Quote ID
   * @param {Object} windowData - Window data
   * @returns {Promise<Object>} - Created window with ID
   */
  async addWindowToQuote(quoteId, windowData) {
    const db = await database.getConnection();
    
    try {
      const now = new Date().toISOString();
      
      // Insert window record
      const result = await new Promise((resolve, reject) => {
        const params = {
          $quote_id: quoteId,
          $location: windowData.location || null,
          $width: windowData.width,
          $height: windowData.height,
          $square_footage: windowData.square_footage,
          $type: windowData.type.toLowerCase(),
          $operation_type: windowData.operation_type,
          $pane_count: windowData.pane_count || 2,
          $glass_type: windowData.glass_type || 'clear',
          $has_low_e: windowData.has_low_e ? 1 : 0,
          $has_grilles: windowData.has_grilles ? 1 : 0,
          $has_interior_color: windowData.has_interior_color ? 1 : 0,
          $has_exterior_color: windowData.has_exterior_color ? 1 : 0,
          $quantity: windowData.quantity || 1,
          $base_price: windowData.base_price,
          $options_price: windowData.options_price,
          $bay_header_footer_cost: windowData.bay_header_footer_cost || null,
          $bay_siding_area: windowData.bay_siding_area || null,
          $bay_siding_cost: windowData.bay_siding_cost || null,
          $shaped_window_cost: windowData.shaped_window_cost || null,
          $window_subtotal: windowData.window_subtotal,
          $installation_price: windowData.installation_price,
          $display_order: windowData.display_order || 0,
          $note: windowData.note || null,
          $created_at: now,
          $updated_at: now
        };
        
        const sql = `
          INSERT INTO quote_windows (
            quote_id, location, width, height, square_footage, type, operation_type,
            pane_count, glass_type, has_low_e, has_grilles, has_interior_color, 
            has_exterior_color, quantity, base_price, options_price, bay_header_footer_cost,
            bay_siding_area, bay_siding_cost, shaped_window_cost, window_subtotal,
            installation_price, display_order, note, created_at, updated_at
          ) VALUES (
            $quote_id, $location, $width, $height, $square_footage, $type, $operation_type,
            $pane_count, $glass_type, $has_low_e, $has_grilles, $has_interior_color,
            $has_exterior_color, $quantity, $base_price, $options_price, $bay_header_footer_cost,
            $bay_siding_area, $bay_siding_cost, $shaped_window_cost, $window_subtotal,
            $installation_price, $display_order, $note, $created_at, $updated_at
          )
        `;
        
        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          // Return the created window with ID
          resolve({
            window_id: this.lastID,
            ...windowData,
            created_at: now,
            updated_at: now
          });
        });
      });
      
      logger.debug('Added window to quote', { quote_id: quoteId, window_id: result.window_id });
      
      // Update quote total
      await this.updateQuoteTotals(quoteId);
      
      return result;
    } catch (error) {
      logger.error(`Error adding window to quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Update a window in a quote
   * @param {number} windowId - Window ID
   * @param {Object} windowData - Updated window data
   * @returns {Promise<boolean>} - Success status
   */
  async updateWindow(windowId, windowData) {
    const db = await database.getConnection();
    
    try {
      const now = new Date().toISOString();
      
      // Get quote ID for later total update
      const quoteId = await new Promise((resolve, reject) => {
        db.get('SELECT quote_id FROM quote_windows WHERE window_id = ?', [windowId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.quote_id : null);
        });
      });
      
      if (!quoteId) {
        logger.warn(`Window ${windowId} not found for update`);
        return false;
      }
      
      // Build update query dynamically
      const updateFields = [];
      const params = {};
      
      for (const [key, value] of Object.entries(windowData)) {
        if (key !== 'window_id' && key !== 'quote_id' && key !== 'created_at') {
          updateFields.push(`${key} = $${key}`);
          
          // Convert booleans to 0/1 for SQLite
          if (typeof value === 'boolean') {
            params[`$${key}`] = value ? 1 : 0;
          } else {
            params[`$${key}`] = value;
          }
        }
      }
      
      // Always update the updated_at timestamp
      updateFields.push('updated_at = $updated_at');
      params.$updated_at = now;
      params.$window_id = windowId;
      
      // Execute update if there are fields to update
      if (updateFields.length > 0) {
        const sql = `UPDATE quote_windows SET ${updateFields.join(', ')} WHERE window_id = $window_id`;
        
        await new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.changes);
          });
        });
      }
      
      // Update quote totals
      await this.updateQuoteTotals(quoteId);
      
      logger.debug(`Updated window ${windowId} in quote ${quoteId}`);
      return true;
    } catch (error) {
      logger.error(`Error updating window ${windowId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Remove a window from a quote
   * @param {number} windowId - Window ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeWindow(windowId) {
    const db = await database.getConnection();
    
    try {
      // Get quote ID for later total update
      const quoteId = await new Promise((resolve, reject) => {
        db.get('SELECT quote_id FROM quote_windows WHERE window_id = ?', [windowId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.quote_id : null);
        });
      });
      
      if (!quoteId) {
        logger.warn(`Window ${windowId} not found for removal`);
        return false;
      }
      
      // Delete window
      const result = await new Promise((resolve, reject) => {
        const sql = `DELETE FROM quote_windows WHERE window_id = ?`;
        
        db.run(sql, [windowId], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      });
      
      if (result) {
        // Update quote totals
        await this.updateQuoteTotals(quoteId);
        logger.debug(`Removed window ${windowId} from quote ${quoteId}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error removing window ${windowId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get windows for a quote
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Array>} - List of windows
   */
  async getWindowsByQuoteId(quoteId) {
    const db = await database.getConnection();
    
    try {
      const windows = await new Promise((resolve, reject) => {
        const sql = `SELECT * FROM quote_windows WHERE quote_id = ? ORDER BY display_order ASC`;
        
        db.all(sql, [quoteId], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Convert SQLite 0/1 to booleans
          for (const row of rows) {
            row.has_low_e = !!row.has_low_e;
            row.has_grilles = !!row.has_grilles;
            row.has_interior_color = !!row.has_interior_color;
            row.has_exterior_color = !!row.has_exterior_color;
          }
          
          resolve(rows);
        });
      });
      
      return windows;
    } catch (error) {
      logger.error(`Error getting windows for quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Update quote totals based on windows
   * @param {number} quoteId - Quote ID
   * @returns {Promise<boolean>} - Success status
   */
  async updateQuoteTotals(quoteId) {
    const db = await database.getConnection();
    
    try {
      // Get all windows for this quote
      const windows = await this.getWindowsByQuoteId(quoteId);
      
      // Calculate total amount
      let totalAmount = 0;
      
      for (const window of windows) {
        // Sum the window subtotal times quantity
        totalAmount += window.window_subtotal * window.quantity;
        
        // Add installation price
        totalAmount += window.installation_price;
      }
      
      // Apply quote-level discount
      const quote = await this.getQuoteById(quoteId);
      if (quote && quote.discount_rate > 0) {
        const discountAmount = totalAmount * quote.discount_rate;
        totalAmount -= discountAmount;
      }
      
      // Update quote total
      const result = await new Promise((resolve, reject) => {
        const sql = `UPDATE quotes SET total_amount = ?, updated_at = ? WHERE id = ?`;
        const now = new Date().toISOString();
        
        db.run(sql, [totalAmount, now, quoteId], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      });
      
      logger.debug(`Updated quote ${quoteId} total to ${totalAmount}`);
      return result;
    } catch (error) {
      logger.error(`Error updating quote ${quoteId} totals:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Add status history record
   * @param {number} quoteId - Quote ID
   * @param {string} previousStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} notes - Notes about the status change
   * @returns {Promise<Object>} - Created status history record
   */
  async addStatusHistory(quoteId, previousStatus, newStatus, notes = '') {
    const db = await database.getConnection();
    
    try {
      const now = new Date().toISOString();
      
      const result = await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO quote_status_history (
            quote_id, previous_status, new_status, changed_at, notes
          ) VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [quoteId, previousStatus, newStatus, now, notes], function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          resolve({
            id: this.lastID,
            quote_id: quoteId,
            previous_status: previousStatus,
            new_status: newStatus,
            changed_at: now,
            notes
          });
        });
      });
      
      logger.debug(`Added status history for quote ${quoteId}: ${previousStatus || 'null'} -> ${newStatus}`);
      return result;
    } catch (error) {
      logger.error(`Error adding status history for quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get status history for a quote
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Array>} - Status history
   */
  async getStatusHistory(quoteId) {
    const db = await database.getConnection();
    
    try {
      const history = await new Promise((resolve, reject) => {
        const sql = `
          SELECT * FROM quote_status_history 
          WHERE quote_id = ? 
          ORDER BY changed_at ASC
        `;
        
        db.all(sql, [quoteId], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        });
      });
      
      return history;
    } catch (error) {
      logger.error(`Error getting status history for quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Add a file record for a quote
   * @param {number} quoteId - Quote ID
   * @param {string} fileType - File type (html, pdf)
   * @param {string} filePath - Path to file
   * @param {string} fileUrl - URL to access file
   * @returns {Promise<Object>} - Created file record
   */
  async addQuoteFile(quoteId, fileType, filePath, fileUrl) {
    const db = await database.getConnection();
    
    try {
      const now = new Date().toISOString();
      
      // Reset is_current flag for existing files of this type
      await new Promise((resolve, reject) => {
        const sql = `UPDATE quote_files SET is_current = 0 WHERE quote_id = ? AND file_type = ?`;
        db.run(sql, [quoteId, fileType], err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Add new file record
      const result = await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO quote_files (
            quote_id, file_type, file_path, file_url, is_current, created_at
          ) VALUES (?, ?, ?, ?, 1, ?)
        `;
        
        db.run(sql, [quoteId, fileType, filePath, fileUrl, now], function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          resolve({
            id: this.lastID,
            quote_id: quoteId,
            file_type: fileType,
            file_path: filePath,
            file_url: fileUrl,
            is_current: true,
            created_at: now
          });
        });
      });
      
      logger.debug(`Added ${fileType} file for quote ${quoteId}`);
      return result;
    } catch (error) {
      logger.error(`Error adding file for quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get current file for a quote
   * @param {number} quoteId - Quote ID
   * @param {string} fileType - File type
   * @returns {Promise<Object>} - File record
   */
  async getCurrentQuoteFile(quoteId, fileType) {
    const db = await database.getConnection();
    
    try {
      const file = await new Promise((resolve, reject) => {
        const sql = `
          SELECT * FROM quote_files 
          WHERE quote_id = ? AND file_type = ? AND is_current = 1
          ORDER BY created_at DESC LIMIT 1
        `;
        
        db.get(sql, [quoteId, fileType], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row || null);
        });
      });
      
      return file;
    } catch (error) {
      logger.error(`Error getting file for quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Get all files for a quote
   * @param {number} quoteId - Quote ID
   * @returns {Promise<Array>} - File records
   */
  async getAllQuoteFiles(quoteId) {
    const db = await database.getConnection();
    
    try {
      const files = await new Promise((resolve, reject) => {
        const sql = `
          SELECT * FROM quote_files 
          WHERE quote_id = ? 
          ORDER BY created_at DESC
        `;
        
        db.all(sql, [quoteId], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Convert is_current to boolean
          for (const row of rows) {
            row.is_current = !!row.is_current;
          }
          
          resolve(rows);
        });
      });
      
      return files;
    } catch (error) {
      logger.error(`Error getting files for quote ${quoteId}:`, error);
      throw error;
    } finally {
      db.close();
    }
  }
  
  /**
   * Find recent quotes
   * @param {number} limit - Maximum number of quotes to return
   * @returns {Promise<Array>} - Recent quotes
   */
  async findRecentQuotes(limit = 10) {
    const db = await database.getConnection();
    
    try {
      const quotes = await new Promise((resolve, reject) => {
        const sql = `
          SELECT * FROM quotes 
          ORDER BY updated_at DESC 
          LIMIT ?
        `;
        
        db.all(sql, [limit], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Parse JSON metadata for each quote
          for (const row of rows) {
            if (row.metadata) {
              try {
                row.metadata = JSON.parse(row.metadata);
              } catch (e) {
                logger.warn(`Failed to parse metadata for quote ${row.id}`);
              }
            }
          }
          
          resolve(rows);
        });
      });
      
      return quotes;
    } catch (error) {
      logger.error('Error finding recent quotes:', error);
      throw error;
    } finally {
      db.close();
    }
  }
}

module.exports = new QuoteModel();