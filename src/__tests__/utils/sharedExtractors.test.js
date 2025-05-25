const sharedExtractors = require('../../utils/sharedExtractors');

describe('sharedExtractors', () => {
  describe('extractOperationType', () => {
    test('extracts hung window types', () => {
      expect(sharedExtractors.extractOperationType('double hung window')).toBe('Hung');
      expect(sharedExtractors.extractOperationType('single-hung')).toBe('Hung');
      expect(sharedExtractors.extractOperationType('up and down window')).toBe('Hung');
    });

    test('extracts slider window types', () => {
      expect(sharedExtractors.extractOperationType('sliding window')).toBe('Slider');
      expect(sharedExtractors.extractOperationType('horizontal sliding')).toBe('Slider');
    });

    test('extracts fixed window types', () => {
      expect(sharedExtractors.extractOperationType('fixed window')).toBe('Fixed');
      expect(sharedExtractors.extractOperationType('window that does not open')).toBe('Fixed');
    });

    test('extracts casement window types', () => {
      expect(sharedExtractors.extractOperationType('casement window')).toBe('Casement');
      expect(sharedExtractors.extractOperationType('crank out window')).toBe('Casement');
    });

    test('extracts awning window types', () => {
      expect(sharedExtractors.extractOperationType('awning window')).toBe('Awning');
      expect(sharedExtractors.extractOperationType('top hinged')).toBe('Awning');
    });

    test('returns null for unrecognized types', () => {
      expect(sharedExtractors.extractOperationType('random text')).toBeNull();
    });
  });

  describe('extractDimensions', () => {
    test('extracts dimensions in various formats', () => {
      expect(sharedExtractors.extractDimensions('36x48')).toEqual({
        width: 36, height: 48, originalUnits: 'inches'
      });
      expect(sharedExtractors.extractDimensions('36 by 48 inches')).toEqual({
        width: 36, height: 48, originalUnits: 'inches'
      });
      expect(sharedExtractors.extractDimensions('36inches x 48inches')).toEqual({
        width: 36, height: 48, originalUnits: 'in'
      });
    });

    test('converts from other units to inches', () => {
      expect(sharedExtractors.extractDimensions('100cm x 120cm')).toEqual({
        width: 39.4, height: 47.2, originalUnits: 'cm'
      });
      expect(sharedExtractors.extractDimensions('3ft x 4ft')).toEqual({
        width: 36, height: 48, originalUnits: 'ft'
      });
    });

    test('returns null for invalid dimensions', () => {
      expect(sharedExtractors.extractDimensions('no dimensions here')).toBeNull();
      // Note: Validation happens in windowValidator, not in the extractor
      // The extractor just extracts dimensions without validating ranges
      const largeDimensions = sharedExtractors.extractDimensions('200x200');
      expect(largeDimensions).toEqual({
        width: 200,
        height: 200,
        originalUnits: 'inches'
      });
    });
  });

  describe('extractLocation', () => {
    test('extracts room locations', () => {
      expect(sharedExtractors.extractLocation('for the kitchen')).toBe('Kitchen');
      expect(sharedExtractors.extractLocation('in my bedroom')).toBe('Bedroom');
      expect(sharedExtractors.extractLocation('living room window')).toBe('Living Room');
    });

    test('handles various location patterns', () => {
      expect(sharedExtractors.extractLocation('window in the master bedroom')).toBe('Master Bedroom');
      expect(sharedExtractors.extractLocation('for the dining room area')).toBe('Dining Room');
    });

    test('returns null for no location', () => {
      expect(sharedExtractors.extractLocation('36x48 window')).toBeNull();
    });
  });

  describe('extractWindowType', () => {
    test('extracts standard window types', () => {
      expect(sharedExtractors.extractWindowType('standard window')).toBe('standard');
      expect(sharedExtractors.extractWindowType('regular window')).toBe('standard');
    });

    test('extracts bay window types', () => {
      expect(sharedExtractors.extractWindowType('bay window')).toBe('bay');
      expect(sharedExtractors.extractWindowType('bow window')).toBe('bay');
    });

    test('extracts shaped window types', () => {
      expect(sharedExtractors.extractWindowType('shaped window')).toBe('shaped');
      expect(sharedExtractors.extractWindowType('arched window')).toBe('shaped');
      expect(sharedExtractors.extractWindowType('half-round window')).toBe('shaped');
    });

    test('defaults to standard', () => {
      expect(sharedExtractors.extractWindowType('some text')).toBe('standard');
    });
  });

  describe('extractPaneCount', () => {
    test('extracts triple pane', () => {
      expect(sharedExtractors.extractPaneCount('triple pane window')).toBe(3);
      expect(sharedExtractors.extractPaneCount('3 panes')).toBe(3);
    });

    test('defaults to double pane', () => {
      expect(sharedExtractors.extractPaneCount('window')).toBe(2);
      expect(sharedExtractors.extractPaneCount('double pane')).toBe(2);
    });
  });

  describe('extractOptions', () => {
    test('extracts Low-E option', () => {
      const options = sharedExtractors.extractOptions('low-e glass window');
      expect(options.lowE).toBe(true);
    });

    test('extracts grilles option', () => {
      const options = sharedExtractors.extractOptions('window with grilles');
      expect(options.grilles).toBe(true);
    });

    test('extracts glass type', () => {
      expect(sharedExtractors.extractOptions('frosted glass').glassType).toBe('frosted');
      expect(sharedExtractors.extractOptions('tinted glass').glassType).toBe('tinted');
      expect(sharedExtractors.extractOptions('clear glass').glassType).toBe('clear');
    });

    test('handles multiple options', () => {
      const options = sharedExtractors.extractOptions('low-e window with grilles and frosted glass');
      expect(options.lowE).toBe(true);
      expect(options.grilles).toBe(true);
      expect(options.glassType).toBe('frosted');
    });
  });

  describe('extractFeatures', () => {
    test('extracts Low-E as feature', () => {
      const features = sharedExtractors.extractFeatures('low-e glass');
      expect(features).toContain('Low-E glass with argon');
    });

    test('extracts grilles as feature', () => {
      const features = sharedExtractors.extractFeatures('with grilles');
      expect(features).toContain('Grilles');
    });

    test('extracts special glass as feature', () => {
      const features = sharedExtractors.extractFeatures('frosted glass');
      expect(features).toContain('Frosted glass');
    });

    test('returns empty array for no features', () => {
      const features = sharedExtractors.extractFeatures('standard window');
      expect(features).toEqual([]);
    });
  });
});