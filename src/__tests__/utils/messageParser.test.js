const messageParser = require('../../utils/messageParser');

describe('MessageParser', () => {
  describe('extractAllSpecifications', () => {
    test('extracts complete specifications from message', () => {
      const message = 'I need a 36x48 hung window for my kitchen with Low-E glass';
      const specs = messageParser.extractAllSpecifications(message);
      
      expect(specs.width).toBe(36);
      expect(specs.height).toBe(48);
      expect(specs.operation_type).toBe('Hung');
      expect(specs.location).toBe('Kitchen');
      expect(specs.has_low_e).toBe(true);
      expect(specs.is_complete).toBe(true);
    });
    
    test('handles missing dimensions', () => {
      const message = 'I need a hung window for my kitchen';
      const specs = messageParser.extractAllSpecifications(message);
      
      expect(specs.width).toBeNull();
      expect(specs.height).toBeNull();
      expect(specs.operation_type).toBe('Hung');
      expect(specs.location).toBe('Kitchen');
      expect(specs.is_complete).toBe(false);
    });
  });

  describe('extractAndValidateSpecifications', () => {
    test('returns valid specifications without validation errors', () => {
      const message = 'I need a 36x48 hung window for my kitchen';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      expect(result.width).toBe(36);
      expect(result.height).toBe(48);
      expect(result.operation_type).toBe('Hung');
      expect(result.location).toBe('Kitchen');
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
      expect(result.validationMessage).toBeUndefined();
    });

    test('validates and provides errors for too small dimensions', () => {
      const message = 'I need a 10x10 window';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      expect(result.width).toBe(10);
      expect(result.height).toBe(10);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Width must be at least 12 inches (1 foot)');
      expect(result.validation.errors).toContain('Height must be at least 12 inches (1 foot)');
      expect(result.validationMessage).toContain('**Issues with your specifications:**');
      expect(result.validationMessage).toContain('**Suggestions:**');
    });

    test('validates and provides errors for too large dimensions', () => {
      const message = 'I need a 150x150 window';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Width cannot exceed 120 inches (10 feet)');
      expect(result.validation.errors).toContain('Height cannot exceed 120 inches (10 feet)');
    });

    test('validates unit conversion', () => {
      const message = 'I need a 100cm x 120cm window';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      // 100cm = 39.4 inches, 120cm = 47.2 inches (valid)
      expect(result.width).toBeCloseTo(39.4, 1);
      expect(result.height).toBeCloseTo(47.2, 1);
      expect(result.originalUnits).toBe('cm');
      expect(result.validation.isValid).toBe(true);
    });

    test('validates missing dimensions', () => {
      const message = 'I need a hung window for my kitchen';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      expect(result.width).toBeNull();
      expect(result.height).toBeNull();
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Both width and height measurements are required to provide a quote');
      expect(result.validation.suggestions).toContain('Please provide window dimensions in inches (e.g., "36x48" or "36 inches by 48 inches")');
    });

    test('validates unusual aspect ratio', () => {
      const message = 'I need a 12x60 window';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      expect(result.width).toBe(12);
      expect(result.height).toBe(60);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('This window appears unusually narrow for its height');
      expect(result.validation.suggestions).toContain('Did you mean 60x12 (width x height) instead?');
    });

    test('includes dimension order suggestion when appropriate', () => {
      const message = 'I need a 72x24 window';
      const result = messageParser.extractAndValidateSpecifications(message);
      
      expect(result.width).toBe(72);
      expect(result.height).toBe(24);
      expect(result.validation.isValid).toBe(true);
      // Suggestion should appear even for valid dimensions when there's potential confusion
      expect(result.validation.suggestions).toContain('Note: Width is typically listed first (width x height). Please verify your measurements.');
    });
  });
});