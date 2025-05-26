const ProfessionalMeasurementService = require('../../services/professionalMeasurementService');

describe('ProfessionalMeasurementService', () => {
  let service;

  beforeEach(() => {
    service = new ProfessionalMeasurementService();
  });

  describe('assessMeasurementComplexity', () => {
    it('should identify bay window as complex', () => {
      const specs = {
        additionalDetails: 'Need quote for bay window in living room'
      };
      
      const result = service.assessMeasurementComplexity(specs);
      
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.factors).toContain('Complex window shape: bay window');
      expect(result.recommendsProfessional).toBe(true);
    });

    it('should identify skylight as complex type', () => {
      const specs = {
        type: 'Skylight'
      };
      
      const result = service.assessMeasurementComplexity(specs);
      
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.factors).toContain('Specialized window type: skylight');
    });

    it('should consider high location as complex', () => {
      const specs = {
        location: '3rd floor bathroom'
      };
      
      const result = service.assessMeasurementComplexity(specs);
      
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.factors).toContain('High location requires special equipment');
    });

    it('should factor in user experience', () => {
      const specs = {
        type: 'Double Hung'
      };
      const userContext = {
        measurementExperience: 'none'
      };
      
      const result = service.assessMeasurementComplexity(specs, userContext);
      
      expect(result.factors).toContain('Limited measurement experience');
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple complexity factors', () => {
      const specs = {
        type: 'Skylight',
        additionalDetails: 'Curved skylight on 4th floor',
        location: '4th floor'
      };
      
      const result = service.assessMeasurementComplexity(specs);
      
      expect(result.score).toBeGreaterThanOrEqual(5);
      expect(result.recommendsProfessional).toBe(true);
      expect(result.reasoning).toContain('strongly recommended');
    });

    it('should recommend DIY for simple windows', () => {
      const specs = {
        type: 'Double Hung',
        location: 'first floor bedroom'
      };
      const userContext = {
        measurementExperience: 'some'
      };
      
      const result = service.assessMeasurementComplexity(specs, userContext);
      
      expect(result.score).toBeLessThan(3);
      expect(result.recommendsProfessional).toBe(false);
    });
  });

  describe('generateMeasurementGuidance', () => {
    it('should generate professional guidance for complex windows', () => {
      const specs = {
        type: 'Bay Window',
        additionalDetails: 'Large bay window with multiple angles'
      };
      const assessment = {
        recommendsProfessional: true,
        reasoning: 'Professional measurement recommended',
        factors: ['Complex window shape: bay window'],
        score: 4
      };
      
      const result = service.generateMeasurementGuidance(specs, assessment);
      
      expect(result.recommendsProfessional).toBe(true);
      expect(result.professionalBenefits).toBeDefined();
      expect(result.professionalBenefits.length).toBeGreaterThan(0);
      expect(result.whyProfessional).toBeDefined();
      expect(result.nextSteps).toBeDefined();
      expect(result.alternativeOptions).toBeDefined();
    });

    it('should generate DIY guidance for simple windows', () => {
      const specs = {
        type: 'Double Hung'
      };
      const assessment = {
        recommendsProfessional: false,
        reasoning: 'Standard DIY measurement should be sufficient',
        factors: [],
        score: 0
      };
      
      const result = service.generateMeasurementGuidance(specs, assessment);
      
      expect(result.recommendsProfessional).toBe(false);
      expect(result.diyGuidance).toBeDefined();
      expect(result.diyGuidance.tools).toBeDefined();
      expect(result.diyGuidance.tips).toBeDefined();
      expect(result.validationOffer).toBeDefined();
    });

    it('should include window-specific tips for DIY', () => {
      const specs = {
        type: 'Casement'
      };
      const assessment = {
        recommendsProfessional: false,
        reasoning: 'DIY measurement possible',
        factors: [],
        score: 1
      };
      
      const result = service.generateMeasurementGuidance(specs, assessment);
      
      const tips = result.diyGuidance.tips;
      const casementTip = tips.find(tip => tip.includes('hinge side'));
      expect(casementTip).toBeDefined();
    });

    it('should provide alternative options', () => {
      const specs = {
        type: 'Arched Window'
      };
      const assessment = {
        recommendsProfessional: true,
        reasoning: 'Complex measurement required',
        factors: ['Complex window shape: arched'],
        score: 3
      };
      
      const result = service.generateMeasurementGuidance(specs, assessment);
      
      expect(result.alternativeOptions).toBeDefined();
      expect(result.alternativeOptions.length).toBeGreaterThan(0);
      
      const optionTypes = result.alternativeOptions.map(opt => opt.action);
      expect(optionTypes).toContain('schedule_professional');
      expect(optionTypes).toContain('defer_measurement');
    });
  });

  describe('validateUserMeasurements', () => {
    it('should validate reasonable measurements', async () => {
      const measurements = {
        width: 36,
        height: 48
      };
      const specs = {
        type: 'Double Hung'
      };
      
      const result = await service.validateUserMeasurements(measurements, specs);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about unusually small measurements', async () => {
      const measurements = {
        width: 10,
        height: 10
      };
      const specs = {
        type: 'Double Hung'
      };
      
      const result = await service.validateUserMeasurements(measurements, specs);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('unusually small'))).toBe(true);
    });

    it('should warn about out-of-square openings', async () => {
      const measurements = {
        width: 36,
        height: 48,
        topWidth: 36,
        bottomWidth: 37
      };
      const specs = {
        type: 'Double Hung'
      };
      
      const result = await service.validateUserMeasurements(measurements, specs);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('out of square'))).toBe(true);
    });

    it('should error on invalid window type measurements', async () => {
      const measurements = {
        width: 36,
        height: 48,
        operableWidth: 24
      };
      const specs = {
        type: 'Picture'
      };
      
      const result = await service.validateUserMeasurements(measurements, specs);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Picture windows'))).toBe(true);
    });
  });

  describe('generateProfessionalReferral', () => {
    it('should generate referral information', () => {
      const result = service.generateProfessionalReferral('12345', {
        type: 'Bay Window'
      });
      
      expect(result.available).toBe(true);
      expect(result.estimatedCost).toBeDefined();
      expect(result.timeframe).toBeDefined();
      expect(result.coverage).toBeDefined();
      expect(result.guarantee).toBeDefined();
      expect(result.booking).toBeDefined();
    });
  });
});