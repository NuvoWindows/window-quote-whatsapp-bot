# Parser Refactoring Documentation

**Last Updated:** May 18, 2025  
**Version:** 1.0.0  
**Author:** Claude AI Assistant

## Overview

This document describes the refactoring of the message parsing system to eliminate code duplication between `messageParser.js` and `windowSpecParser.js`.

## Problem

Both parsers had significant code duplication (~60%) for extracting window specifications from text. This created:
- Maintenance burden (changes needed in two places)
- Risk of inconsistent behavior
- Violation of DRY principle (Don't Repeat Yourself)

## Solution

Created a shared module `sharedExtractors.js` containing common extraction logic used by both parsers.

## Shared Extractors

The following extraction methods were moved to the shared module:

1. **extractOperationType(text)** - Extracts window operation type (Hung, Slider, Fixed, etc.)
2. **extractDimensions(text)** - Extracts width and height with unit conversion
3. **extractLocation(text)** - Extracts room/location information
4. **extractWindowType(text)** - Extracts window type (standard, bay, shaped)
5. **extractPaneCount(text)** - Extracts pane count (2 or 3)
6. **extractGlassType(text)** - Alternative glass type extraction
7. **extractOptions(text)** - Extracts options (Low-E, grilles, glass type)
8. **extractFeatures(text)** - Extracts features array format

## Implementation Details

### Step 1: Create Shared Module
- Created `src/utils/sharedExtractors.js`
- Moved common extraction logic from both parsers
- Added JSDoc comments for all methods

### Step 2: Update Parsers
- Modified both parsers to import and use shared extractors
- Kept legacy implementations as deprecated methods for reference
- Maintained backward compatibility

### Step 3: Testing
- Created comprehensive test suite for shared extractors
- All tests passing (26 tests total)
- Verified no breaking changes

### Step 4: Documentation
- Updated ARCHITECTURE.md to document the shared extractors
- Created this documentation file

## Benefits

1. **Eliminated Duplication**: Reduced code duplication from ~60% to minimal
2. **Single Source of Truth**: All extraction patterns in one place
3. **Easier Maintenance**: Update patterns once, affects both parsers
4. **Consistent Behavior**: Both parsers use identical extraction logic
5. **Better Testing**: Centralized testing for extraction methods

## Architecture

```
                    ┌─────────────────────┐
                    │ sharedExtractors.js │
                    └─────────┬───────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
          ┌─────────▼──────┐  ┌─────────▼──────────┐
          │ messageParser.js│  │ windowSpecParser.js│
          └────────────────┘  └───────────────────┘
```

## Future Considerations

1. Remove deprecated methods after thorough testing
2. Consider adding more sophisticated extraction patterns
3. Add confidence scoring to extraction methods
4. Consider machine learning approaches for pattern matching

## Migration Notes

When updating extraction patterns:
1. Update the pattern in `sharedExtractors.js`
2. All parsers automatically get the update
3. Update tests in `sharedExtractors.test.js`
4. Run test suite to verify changes

## Change Log

### Version 1.0.0 - May 18, 2025
- Initial refactoring implementation
- Created shared extractors module
- Updated both parsers to use shared module
- Added comprehensive test suite
- Updated documentation

## Conclusion

The refactoring successfully eliminated code duplication while maintaining the architectural separation between parsers. The shared module approach provides a clean, maintainable solution that preserves the distinct purposes of each parser while sharing common logic.