const windowValidator = require('../../utils/windowValidator');

describe('WindowValidator', () => {
  describe('validateDimensions', () => {
    test('validates valid dimensions', () => {
      const result = windowValidator.validateDimensions(36, 48);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    test('rejects missing dimensions', () => {
      const result = windowValidator.validateDimensions(null, null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Both width and height measurements are required to provide a quote');
      expect(result.suggestions).toContain('Please provide window dimensions in inches (e.g., "36x48" or "36 inches by 48 inches")');
    });

    test('rejects non-numeric dimensions', () => {
      const result = windowValidator.validateDimensions('36', '48');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Width and height must be numeric values');
    });

    test('rejects dimensions below minimum', () => {
      const result = windowValidator.validateDimensions(10, 10);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Width must be at least 12 inches (1 foot)');
      expect(result.errors).toContain('Height must be at least 12 inches (1 foot)');
      expect(result.suggestions).toContain('Standard windows start at 12 inches wide. Did you mean a larger size?');
    });

    test('rejects dimensions above maximum', () => {
      const result = windowValidator.validateDimensions(125, 125);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Width cannot exceed 120 inches (10 feet)');
      expect(result.errors).toContain('Height cannot exceed 120 inches (10 feet)');
      expect(result.suggestions).toContain('For windows wider than 10 feet, please contact us for a custom quote');
    });

    test('warns about unusual aspect ratios - too narrow', () => {
      const result = windowValidator.validateDimensions(12, 60);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This window appears unusually narrow for its height');
      expect(result.suggestions).toContain('Did you mean 60x12 (width x height) instead?');
    });

    test('warns about unusual aspect ratios - too wide', () => {
      const result = windowValidator.validateDimensions(80, 15);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This window appears unusually wide for its height');
      expect(result.suggestions).toContain('Did you mean 15x80 (width x height) instead?');
    });

    test('suggests dimension order check', () => {
      const result = windowValidator.validateDimensions(72, 24);
      expect(result.isValid).toBe(true);
      expect(result.suggestions).toContain('Note: Width is typically listed first (width x height). Please verify your measurements.');
    });
  });

  describe('validateUnitConversion', () => {
    test('accepts inches without conversion', () => {
      const result = windowValidator.validateUnitConversion({
        width: 36,
        height: 48,
        originalUnits: 'inches'
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects conversion with too small results', () => {
      const result = windowValidator.validateUnitConversion({
        width: 0.5,
        height: 0.5,
        originalUnits: 'meters'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unit conversion resulted in dimensions that are too small');
    });

    test('rejects conversion with too large results', () => {
      const result = windowValidator.validateUnitConversion({
        width: 600,
        height: 600,
        originalUnits: 'cm'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unit conversion resulted in dimensions that are too large');
    });
  });

  describe('validateWindowSpecifications', () => {
    test('validates complete valid specifications', () => {
      const specs = {
        width: 36,
        height: 48,
        originalUnits: 'inches',
        operation_type: 'Hung',
        window_type: 'standard'
      };
      const result = windowValidator.validateWindowSpecifications(specs);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    test('combines multiple validation errors', () => {
      const specs = {
        width: 10,
        height: 130,
        originalUnits: 'inches'
      };
      const result = windowValidator.validateWindowSpecifications(specs);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Width must be at least 12 inches (1 foot)');
      expect(result.errors).toContain('Height cannot exceed 120 inches (10 feet)');
    });

    test('logs validation failures', () => {
      // Mock logger to verify it's called
      const loggerWarnSpy = jest.spyOn(require('../../utils/logger'), 'warn');
      
      const specs = {
        width: 5,
        height: 5
      };
      windowValidator.validateWindowSpecifications(specs);
      
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Window specification validation failed',
        expect.objectContaining({
          errors: expect.any(Array),
          suggestions: expect.any(Array),
          specs: expect.objectContaining({
            width: 5,
            height: 5
          })
        })
      );
      
      loggerWarnSpy.mockRestore();
    });
  });

  describe('formatValidationMessage', () => {
    test('formats errors and suggestions', () => {
      const validationResult = {
        errors: ['Error 1', 'Error 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        warnings: []
      };
      
      const message = windowValidator.formatValidationMessage(validationResult);
      expect(message).toContain('**Issues with your specifications:**');
      expect(message).toContain('• Error 1');
      expect(message).toContain('• Error 2');
      expect(message).toContain('**Suggestions:**');
      expect(message).toContain('• Suggestion 1');
      expect(message).toContain('• Suggestion 2');
    });

    test('handles empty validation result', () => {
      const validationResult = {
        errors: [],
        suggestions: [],
        warnings: []
      };
      
      const message = windowValidator.formatValidationMessage(validationResult);
      expect(message).toBe('');
    });
  });

  describe('getDimensionRequirements', () => {
    test('returns dimension requirements message', () => {
      const requirements = windowValidator.getDimensionRequirements();
      expect(requirements).toBe('Window dimensions must be between 12" and 120" (1 to 10 feet) for both width and height.');
    });
  });
});