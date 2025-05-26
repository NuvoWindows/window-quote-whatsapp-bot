const QuestionGenerator = require('../../utils/questionGenerator');

describe('QuestionGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new QuestionGenerator();
  });

  describe('generateQuestion', () => {
    test('should generate appropriate questions for missing window type', () => {
      const field = {
        field: 'operation_type',
        label: 'Operation Type',
        priority: 1,
        type: 'string'
      };
      
      const question = generator.generateQuestion(field, {});
      
      expect(question).toContain('open');
      expect(question.toLowerCase()).toContain('casement');
      expect(question.toLowerCase()).toContain('hung');
    });

    test('should generate context-aware questions for dimensions', () => {
      const field = {
        field: 'width',
        label: 'Width',
        priority: 1,
        type: 'number'
      };
      const specs = { operation_type: 'casement' };
      
      const question = generator.generateQuestion(field, specs);
      
      expect(question).toContain('width');
      expect(question).toContain('inches');
    });

    test('should adapt questions based on context', () => {
      const field = {
        field: 'height',
        label: 'Height',
        priority: 1,
        type: 'number'
      };
      
      const specsWithWidth = { width: '48' };
      const question = generator.generateQuestion(field, specsWithWidth);
      
      expect(question).toContain('height');
      expect(question).toContain('48'); // Should reference existing width
    });

    test('should generate clarification questions when needed', () => {
      const field = {
        field: 'width',
        label: 'Width',
        priority: 1,
        type: 'number',
        value: 'invalid'
      };
      const specs = { operation_type: 'casement', width: 'invalid' };
      
      const question = generator.generateQuestion(field, specs, 'correct');
      
      expect(question).toContain('width');
      expect(question.length).toBeGreaterThan(0);
    });

    test('should handle edge cases gracefully', () => {
      const field = {
        field: 'unknownField',
        label: 'Unknown Field',
        priority: 5,
        type: 'string'
      };
      
      const question = generator.generateQuestion(field, {});
      
      expect(question).toBeDefined();
      expect(question.length).toBeGreaterThan(0);
      expect(question).toContain('unknown field');
    });
  });

  describe('generateCollectionQuestion', () => {
    test('should prioritize based on existing specifications', () => {
      const field = {
        field: 'width',
        label: 'Width',
        priority: 1,
        type: 'number'
      };
      const specsWithHeight = { height: '36' };
      
      const question = generator.generateCollectionQuestion(field, specsWithHeight);
      
      expect(question).toContain('width');
      expect(question).toContain('36'); // Should reference existing height
    });

    test('should provide helpful context for glass type questions', () => {
      const field = {
        field: 'glass_type',
        label: 'Glass Type',
        priority: 2,
        type: 'string'
      };
      const specs = { operation_type: 'casement', width: '72', height: '48', pane_count: 2 };
      
      const question = generator.generateCollectionQuestion(field, specs);
      
      expect(question).toContain('glass');
      expect(question).toContain('double'); // Should reference pane count as "double-pane"
    });
  });

  describe('generateCorrectionQuestion', () => {
    test('should create appropriate clarification requests', () => {
      const field = {
        field: 'width',
        label: 'Width',
        priority: 1,
        type: 'number',
        value: 'medium'
      };
      const specs = { operation_type: 'casement', width: 'medium' };
      
      const question = generator.generateCorrectionQuestion(field, specs);
      
      expect(question).toContain('width');
      expect(question).toContain('inches');
    });
  });

  describe('generateSummaryQuestion', () => {
    test('should handle multiple missing fields intelligently', () => {
      const missingFields = [
        { field: 'width', label: 'Width', priority: 1, type: 'number' },
        { field: 'height', label: 'Height', priority: 1, type: 'number' }
      ];
      const specs = { operation_type: 'casement' };
      
      const question = generator.generateSummaryQuestion(missingFields, specs);
      
      expect(question).toContain('dimensions');
      expect(question).toContain('width and height');
    });

    test('should handle single missing field', () => {
      const missingFields = [
        { field: 'glass_type', label: 'Glass Type', priority: 2, type: 'string' }
      ];
      const specs = { operation_type: 'casement', width: '48', height: '36' };
      
      const question = generator.generateSummaryQuestion(missingFields, specs);
      
      expect(question).toContain('glass');
    });

    test('should return completion message when no fields missing', () => {
      const question = generator.generateSummaryQuestion([], {});
      
      expect(question).toContain('all the information');
    });
  });

  describe('generateProgressMessage', () => {
    test('should provide encouraging messages based on completion', () => {
      expect(generator.generateProgressMessage(95, [])).toContain('almost done');
      expect(generator.generateProgressMessage(75, [])).toContain('close');
      expect(generator.generateProgressMessage(50, [])).toContain('halfway');
      expect(generator.generateProgressMessage(25, [])).toContain('continue');
      expect(generator.generateProgressMessage(10, [])).toContain('gather');
    });
  });

  describe('shouldUseDetailedQuestion', () => {
    test('should return boolean for using detailed questions', () => {
      const result = generator.shouldUseDetailedQuestion({});
      expect(typeof result).toBe('boolean');
    });

    test('should prefer detailed questions for beginners', () => {
      const specs = { _conversationMeta: { userKnowledgeLevel: 'beginner' } };
      const result = generator.shouldUseDetailedQuestion(specs);
      expect(result).toBe(true);
    });
  });

  describe('integration with SpecificationValidator', () => {
    test('should work with field objects from SpecificationValidator', () => {
      // Simulate field object structure from SpecificationValidator
      const missingFields = [
        {
          field: 'width',
          label: 'Width',
          priority: 1,
          type: 'number'
        },
        {
          field: 'height',
          label: 'Height',
          priority: 1,
          type: 'number'
        },
        {
          field: 'glass_type',
          label: 'Glass Type',
          priority: 2,
          type: 'string'
        }
      ];

      const specs = { operation_type: 'casement' };

      missingFields.forEach(field => {
        const question = generator.generateQuestion(field, specs);
        expect(question).toBeDefined();
        expect(question.length).toBeGreaterThan(0);
        expect(typeof question).toBe('string');
      });
    });

    test('should handle invalid field objects gracefully', () => {
      const invalidFields = [
        {
          field: 'width',
          label: 'Width',
          priority: 1,
          type: 'number',
          value: 'invalid'
        }
      ];

      const specs = { operation_type: 'casement', width: 'invalid' };

      invalidFields.forEach(field => {
        const question = generator.generateQuestion(field, specs, 'correct');
        expect(question).toBeDefined();
        expect(question.length).toBeGreaterThan(0);
      });
    });
  });

  describe('question quality', () => {
    test('should generate helpful questions with context', () => {
      const field = {
        field: 'operation_type',
        label: 'Operation Type',
        priority: 1,
        type: 'string'
      };
      
      const question = generator.generateQuestion(field, {});
      
      // Should include examples or explanations
      expect(question.length).toBeGreaterThan(20);
      expect(question).toMatch(/casement|hung|slider|fixed|awning/i);
    });

    test('should generate concise but informative questions', () => {
      const field = {
        field: 'width',
        label: 'Width',
        priority: 1,
        type: 'number'
      };
      
      const question = generator.generateQuestion(field, {});
      
      expect(question).toContain('width');
      expect(question).toContain('inches');
      expect(question.length).toBeLessThan(200); // Not too verbose
    });
  });
});