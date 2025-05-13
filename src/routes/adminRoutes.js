/**
 * Admin Routes for Window Quote WhatsApp Bot
 * Provides endpoints for viewing and managing conversations
 */

const express = require('express');
const router = express.Router();
const conversationManager = require('../services/conversationManager');
const logger = require('../utils/logger');
const config = require('../config/config');

// Simple authentication middleware - in production, use a proper authentication system
const authMiddleware = (req, res, next) => {
  const adminToken = config.admin.token;
  
  // Skip auth check if no token is set (development only)
  if (!adminToken) {
    logger.warn('No ADMIN_TOKEN set, skipping authentication');
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Unauthorized access attempt to admin route', { 
      ip: req.ip, 
      path: req.path 
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (token !== adminToken) {
    logger.warn('Invalid token provided for admin route', { 
      ip: req.ip, 
      path: req.path 
    });
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
};

// List all active conversations
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await conversationManager.listActiveConversations();
    res.json(conversations);
  } catch (error) {
    logger.error('Error listing conversations', { error: error.message });
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// Get conversation details
router.get('/conversations/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all messages for this conversation
    const messages = await conversationManager.getConversationContext(userId, 1000);
    
    // Get window specifications for this user
    const specs = await conversationManager.getWindowSpecifications(userId);
    
    res.json({ 
      userId,
      messages,
      specifications: specs
    });
  } catch (error) {
    logger.error('Error getting conversation details', { 
      error: error.message, 
      userId: req.params.userId 
    });
    res.status(500).json({ error: 'Failed to get conversation details' });
  }
});

// Delete a conversation
router.delete('/conversations/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const deleted = await conversationManager.deleteConversation(userId);
    
    if (deleted) {
      logger.info('Conversation deleted', { userId });
      res.json({ success: true, message: 'Conversation deleted' });
    } else {
      logger.warn('Conversation not found for deletion', { userId });
      res.status(404).json({ error: 'Conversation not found' });
    }
  } catch (error) {
    logger.error('Error deleting conversation', { 
      error: error.message, 
      userId: req.params.userId 
    });
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Force expire old conversations
router.post('/expire-conversations', authMiddleware, async (req, res) => {
  try {
    const count = await conversationManager.expireOldConversations();
    logger.info('Manually expired old conversations', { count });
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Error expiring conversations', { error: error.message });
    res.status(500).json({ error: 'Failed to expire conversations' });
  }
});

module.exports = router;