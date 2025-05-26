const SpecificationValidator = require('../../utils/specificationValidator');

describe('SpecificationValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SpecificationValidator();
  });

  describe('validateSpecifications', () => {
    test('should validate complete specifications', () => {
      const specs = {
        operation_type: 'casement',
        width: '48',
        height: '36',
        glass_type: 'clear',
        pane_count: 2,
        has_low_e: false,
        has_argon: false,
        frame_material: 'vinyl',
        grid_type: 'none'
      };

      const result = validator.validateSpecifications(specs);
      
      expect(result.isValid).toBe(true);
      expect(result.canGenerateQuote).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.completionPercentage).toBeGreaterThan(80);
    });

    test('should detect missing critical fields', () => {
      const specs = {
        operation_type: 'casement'
      };

      const result = validator.validateSpecifications(specs);
      
      expect(result.isValid).toBe(false);
      expect(result.canGenerateQuote).toBe(false);
      expect(result.missing.map(m => m.field)).toContain('width');
      expect(result.missing.map(m => m.field)).toContain('height');
      expect(result.completionPercentage).toBeLessThan(50);
    });

    test('should allow quote generation with partial but sufficient data', () => {
      const specs = {
        operation_type: 'casement',
        width: '48',
        height: '36'
      };

      const result = validator.validateSpecifications(specs);
      
      expect(result.isValid).toBe(false); // Not all fields present
      expect(result.canGenerateQuote).toBe(true); // But sufficient for quote
      expect(result.missing.map(m => m.field)).toContain('glass_type');
      expect(result.missing.map(m => m.field)).toContain('pane_count');
    });

    test('should detect invalid dimensions', () => {
      const specs = {
        operation_type: 'casement',
        width: 'invalid',
        height: '36'
      };

      const result = validator.validateSpecifications(specs);
      
      expect(result.invalid.map(i => i.field)).toContain('width');
    });

    test('should handle empty specifications', () => {
      const result = validator.validateSpecifications({});
      
      expect(result.isValid).toBe(false);
      expect(result.canGenerateQuote).toBe(false);
      expect(result.missing.map(m => m.field)).toContain('operation_type');
      expect(result.completionPercentage).toBe(0);
    });

    test('should provide warnings for unusual dimensions', () => {
      const specs = {
        operation_type: 'casement',
        width: '120', // Very wide
        height: '30'  // Short - creates unusual aspect ratio
      };

      const result = validator.validateSpecifications(specs);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('unusually wide'))).toBe(true);
    });

    test('should provide logical consistency warnings', () => {
      const specs = {
        operation_type: 'casement',
        width: '48',
        height: '36',
        pane_count: 1,
        has_low_e: true // Inconsistent with single pane
      };

      const result = validator.validateSpecifications(specs);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('Single pane'))).toBe(true);
    });
  });

  describe('getNextMissingField', () => {
    test('should return invalid fields before missing fields', () => {
      const specs = {
        operation_type: 'casement',
        width: 'invalid'
      };

      const result = validator.validateSpecifications(specs);
      const nextField = validator.getNextMissingField(result);
      
      expect(nextField.field).toBe('width');
      expect(nextField.action).toBe('correct');
    });

    test('should return highest priority missing field', () => {
      const specs = {
        operation_type: 'casement'
      };

      const result = validator.validateSpecifications(specs);
      const nextField = validator.getNextMissingField(result);
      
      expect(nextField.field).toEqual(expect.stringMatching(/width|height/));
      expect(nextField.action).toBe('collect');
      expect(nextField.priority).toBe(1);
    });

    test('should return null when specifications are complete', () => {
      const specs = {
        operation_type: 'casement',
        width: '48',
        height: '36',
        glass_type: 'clear',
        pane_count: 2,
        has_low_e: false,
        has_argon: false,
        frame_material: 'vinyl',
        grid_type: 'none'
      };

      const result = validator.validateSpecifications(specs);
      const nextField = validator.getNextMissingField(result);
      
      expect(nextField).toBeNull();
    });
  });

  describe('canGenerateQuote', () => {
    test('should return true for complete critical fields', () => {
      const missing = [
        { field: 'glass_type', priority: 2 },
        { field: 'frame_material', priority: 4 }
      ];
      const invalid = [];
      
      const canGenerate = validator.canGenerateQuote(missing, invalid);
      expect(canGenerate).toBe(true);
    });

    test('should return false for missing critical fields', () => {
      const missing = [
        { field: 'width', priority: 1 },
        { field: 'glass_type', priority: 2 }
      ];
      const invalid = [];
      
      const canGenerate = validator.canGenerateQuote(missing, invalid);
      expect(canGenerate).toBe(false);
    });

    test('should return false when invalid fields exist', () => {
      const missing = [];
      const invalid = [
        { field: 'width', priority: 1 }
      ];
      
      const canGenerate = validator.canGenerateQuote(missing, invalid);
      expect(canGenerate).toBe(false);
    });
  });

  describe('applyDefaults', () => {
    test('should apply default values for missing optional fields', () => {
      const specs = {
        operation_type: 'casement',
        width: '48',
        height: '36',
        pane_count: 2
      };

      const withDefaults = validator.applyDefaults(specs);
      
      expect(withDefaults.frame_material).toBe('vinyl');
      expect(withDefaults.grid_type).toBe('none');
      expect(withDefaults.has_low_e).toBe(true); // Default for multi-pane
      expect(withDefaults.has_argon).toBe(true); // Default for multi-pane
    });

    test('should not override existing values', () => {
      const specs = {
        operation_type: 'casement',
        width: '48',
        height: '36',
        pane_count: 2,
        frame_material: 'wood'
      };

      const withDefaults = validator.applyDefaults(specs);
      
      expect(withDefaults.frame_material).toBe('wood'); // Should not be overridden
    });

    test('should apply single-pane defaults', () => {
      const specs = {
        operation_type: 'fixed',
        width: '24',
        height: '24',
        pane_count: 1
      };

      const withDefaults = validator.applyDefaults(specs);
      
      expect(withDefaults.has_low_e).toBe(false); // Default for single-pane
      expect(withDefaults.has_argon).toBe(false); // Default for single-pane
    });
  });

  describe('getValidationSummary', () => {
    test('should provide summary for valid specifications', () => {
      const result = {
        isValid: true,
        missing: [],
        invalid: [],
        canGenerateQuote: true
      };

      const summary = validator.getValidationSummary(result);
      expect(summary).toContain('complete and valid');
    });

    test('should provide summary for incomplete specifications', () => {
      const result = {
        isValid: false,
        missing: [{ field: 'width' }],
        invalid: [{ field: 'height' }],
        canGenerateQuote: false
      };

      const summary = validator.getValidationSummary(result);
      expect(summary).toContain('1 field(s) need correction');
      expect(summary).toContain('1 field(s) are missing');
      expect(summary).toContain('More information needed');
    });
  });

  describe('validation rules', () => {
    test('should validate operation types correctly', () => {
      const validTypes = ['fixed', 'hung', 'slider', 'casement', 'awning', 'hopper'];
      
      validTypes.forEach(type => {
        const result = validator.validateSpecifications({ operation_type: type });
        expect(result.invalid.map(i => i.field)).not.toContain('operation_type');
      });

      const result = validator.validateSpecifications({ operation_type: 'invalid' });
      expect(result.invalid.map(i => i.field)).toContain('operation_type');
    });

    test('should validate dimensions correctly', () => {
      // Valid dimensions
      expect(validator.validateSpecifications({ width: '48', height: '36' }).invalid).toHaveLength(0);
      expect(validator.validateSpecifications({ width: 48, height: 36 }).invalid).toHaveLength(0);
      
      // Invalid dimensions
      expect(validator.validateSpecifications({ width: 'abc' }).invalid.map(i => i.field)).toContain('width');
      expect(validator.validateSpecifications({ width: '0' }).invalid.map(i => i.field)).toContain('width');
      expect(validator.validateSpecifications({ width: '150' }).invalid.map(i => i.field)).toContain('width'); // Too large
    });

    test('should validate glass types correctly', () => {
      const validTypes = ['clear', 'tinted', 'low_e', 'tempered'];
      
      validTypes.forEach(type => {
        const result = validator.validateSpecifications({ glass_type: type });
        expect(result.invalid.map(i => i.field)).not.toContain('glass_type');
      });
    });

    test('should validate pane count correctly', () => {
      [1, 2, 3].forEach(count => {
        const result = validator.validateSpecifications({ pane_count: count });
        expect(result.invalid.map(i => i.field)).not.toContain('pane_count');
      });

      const result = validator.validateSpecifications({ pane_count: 4 });
      expect(result.invalid.map(i => i.field)).toContain('pane_count');
    });
  });
});