const MeasurementDeferralService = require('../../services/measurementDeferralService');

describe('MeasurementDeferralService', () => {
  let service;
  let mockConversationManager;

  beforeEach(() => {
    mockConversationManager = {
      saveConversationContext: jest.fn().mockResolvedValue(true),
      getConversationContext: jest.fn().mockResolvedValue(null),
      getPartialSpecification: jest.fn().mockResolvedValue({}),
      savePartialSpecification: jest.fn().mockResolvedValue(true)
    };
    
    service = new MeasurementDeferralService(mockConversationManager);
  });

  describe('createDeferral', () => {
    it('should create deferral for need_tools reason', async () => {
      const userId = 'user123';
      const reason = 'need_tools';
      const partialSpecs = {
        type: 'Double Hung',
        material: 'Vinyl'
      };
      
      const result = await service.createDeferral(userId, reason, partialSpecs);
      
      expect(result.success).toBe(true);
      expect(result.deferralId).toBeDefined();
      expect(result.deferralId).toMatch(/^def_/);
      expect(result.guidance).toBeDefined();
      expect(result.guidance.message).toContain('tape measure');
      expect(result.resumptionInstructions).toBeDefined();
      
      expect(mockConversationManager.saveConversationContext).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          hasDeferredQuote: true,
          deferralData: expect.objectContaining({
            reason,
            partialSpecs,
            status: 'active'
          })
        })
      );
    });

    it('should create deferral for need_professional reason', async () => {
      const userId = 'user456';
      const reason = 'need_professional';
      const partialSpecs = {
        type: 'Bay Window',
        additionalDetails: 'Complex curved bay window'
      };
      
      const result = await service.createDeferral(userId, reason, partialSpecs);
      
      expect(result.success).toBe(true);
      expect(result.guidance.professionalOptions).toBeDefined();
      expect(result.guidance.nextSteps).toContain('Book professional measurement');
    });

    it('should summarize saved specifications', async () => {
      const userId = 'user789';
      const reason = 'prefer_later';
      const partialSpecs = {
        windowCount: 5,
        type: 'Casement',
        material: 'Wood',
        features: ['Double Pane', 'Low-E']
      };
      
      const result = await service.createDeferral(userId, reason, partialSpecs);
      
      expect(result.success).toBe(true);
      expect(result.guidance.savedInfo).toContain('5 windows');
      expect(result.guidance.savedInfo).toContain('Type: Casement');
      expect(result.guidance.savedInfo).toContain('Material: Wood');
      expect(result.guidance.savedInfo).toContain('Features: Double Pane, Low-E');
    });

    it('should handle deferral creation errors', async () => {
      mockConversationManager.saveConversationContext.mockRejectedValueOnce(
        new Error('Database error')
      );
      
      const result = await service.createDeferral('user123', 'need_tools', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save');
    });
  });

  describe('resumeDeferredQuote', () => {
    it('should resume valid deferred quote', async () => {
      const userId = 'user123';
      const deferralId = 'def_test123';
      const deferralData = {
        deferralId,
        reason: 'need_tools',
        createdAt: new Date().toISOString(),
        partialSpecs: {
          type: 'Double Hung',
          material: 'Vinyl'
        },
        status: 'active'
      };
      
      mockConversationManager.getConversationContext.mockResolvedValueOnce({
        metadata: { deferralData }
      });
      
      const result = await service.resumeDeferredQuote(userId, deferralId);
      
      expect(result.success).toBe(true);
      expect(result.partialSpecs).toEqual(deferralData.partialSpecs);
      expect(result.message).toContain('measuring tools ready');
      expect(result.missingFields).toContain('width');
      expect(result.missingFields).toContain('height');
      
      expect(mockConversationManager.saveConversationContext).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          hasDeferredQuote: false,
          deferralData: expect.objectContaining({
            status: 'resumed',
            resumedAt: expect.any(String)
          })
        })
      );
    });

    it('should reject expired deferrals', async () => {
      const userId = 'user123';
      const deferralId = 'def_old123';
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      
      const deferralData = {
        deferralId,
        reason: 'need_tools',
        createdAt: oldDate.toISOString(),
        partialSpecs: {},
        status: 'active'
      };
      
      mockConversationManager.getConversationContext.mockResolvedValueOnce({
        metadata: { deferralData }
      });
      
      const result = await service.resumeDeferredQuote(userId, deferralId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
      expect(result.suggestion).toBeDefined();
    });

    it('should handle missing deferral', async () => {
      const userId = 'user123';
      const deferralId = 'def_notfound';
      
      mockConversationManager.getConversationContext.mockResolvedValueOnce({
        metadata: {}
      });
      
      const result = await service.resumeDeferredQuote(userId, deferralId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should identify missing fields for multi-window quotes', async () => {
      const deferralData = {
        deferralId: 'def_multi123',
        reason: 'need_tools',
        createdAt: new Date().toISOString(),
        partialSpecs: {
          windowCount: 3,
          type: 'Double Hung'
        },
        status: 'active'
      };
      
      mockConversationManager.getConversationContext.mockResolvedValueOnce({
        metadata: { deferralData }
      });
      
      const result = await service.resumeDeferredQuote('user123', 'def_multi123');
      
      expect(result.success).toBe(true);
      expect(result.missingFields).toContain('individual window measurements');
    });
  });

  describe('sendDeferralReminder', () => {
    it('should send reminder at 3 days', async () => {
      const userId = 'user123';
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const deferralData = {
        deferralId: 'def_remind123',
        reason: 'need_tools',
        createdAt: threeDaysAgo.toISOString(),
        remindersSent: 0,
        lastReminderAt: null
      };
      
      const result = await service.sendDeferralReminder(userId, deferralData);
      
      expect(result.shouldSend).toBe(true);
      expect(result.message).toContain('3 days ago');
      expect(result.message).toContain('measuring tools');
      expect(result.message).toContain('def_remind123');
    });

    it('should not send duplicate reminders', async () => {
      const userId = 'user123';
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const deferralData = {
        deferralId: 'def_remind123',
        reason: 'need_tools',
        createdAt: threeDaysAgo.toISOString(),
        remindersSent: 1, // Already sent 3-day reminder
        lastReminderAt: threeDaysAgo.toISOString()
      };
      
      const result = await service.sendDeferralReminder(userId, deferralData);
      
      expect(result.shouldSend).toBe(false);
    });

    it('should send appropriate reminder for professional measurement', async () => {
      const userId = 'user123';
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const deferralData = {
        deferralId: 'def_pro123',
        reason: 'need_professional',
        createdAt: sevenDaysAgo.toISOString(),
        remindersSent: 1,
        lastReminderAt: null
      };
      
      const result = await service.sendDeferralReminder(userId, deferralData);
      
      expect(result.shouldSend).toBe(true);
      expect(result.message).toContain('professional measurements');
    });
  });

  describe('generateResumptionMessage', () => {
    it('should generate appropriate message for each reason', () => {
      const reasons = [
        { reason: 'need_tools', expectedText: 'measuring tools ready' },
        { reason: 'need_access', expectedText: 'window area now accessible' },
        { reason: 'need_professional', expectedText: 'professional measurements' },
        { reason: 'need_daylight', expectedText: 'Ready to measure' },
        { reason: 'need_assistance', expectedText: 'someone to help' },
        { reason: 'prefer_later', expectedText: 'Ready to complete' }
      ];
      
      reasons.forEach(({ reason, expectedText }) => {
        const deferralData = { reason };
        const message = service.generateResumptionMessage(deferralData);
        expect(message).toContain(expectedText);
      });
    });
  });
});