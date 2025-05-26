# Multi-Panel Window Support Implementation

**Created:** May 25, 2025  
**Status:** Future Enhancement

## Background

Current system treats each window as a single unit with one operation type. Many windows have multiple panels with different operation types (e.g., fixed center with casement sides).

## Implementation Details

### 1. Data Model Changes
- Create `window_panels` table to store panel-level details
- Each window can have multiple panels with own dimensions and operation types
- Store panel position (left, center, right) and configuration

### 2. Message Parser Enhancement
- Parse configurations like "fixed center with casement sides"
- Extract individual panel dimensions: "center 48x60, sides 24x60"
- Handle common multi-panel patterns and terminology
- Return panel array in specifications

### 3. System Prompt Updates
- Educate Claude on multi-panel window terminology
- Guide question flow for panel configurations
- Handle complex specs like "bay window with fixed center, double-hung sides"
- Update information gathering sequence for panel details

### 4. Pricing Logic Overhaul
- Calculate each panel's price separately
- Window price is sum of panels
- Update bay window calculations (already multi-section)

### 5. Validation System Updates
- Panel-specific dimension validation
- Compatibility checks between adjacent panels
- Different min/max ranges per panel based on operation type
- Each operation type should have its own dimension ranges

### 6. Quote Generation Changes
- Sum panel costs for totals
- Update PDF templates for panel details
- Display panel configuration clearly

### 7. UI/UX Impact
- Admin interface needs panel management
- Quote display must show panel configurations
- Conversation flow becomes more complex
- Need visual representation of panel layouts

## Implementation Phases

1. **Foundation**: Document limitations, gather multi-panel request data
2. **Data Model Evolution**: Schema updates, migration scripts
3. **Parser Enhancement**: Multi-panel parsing patterns
4. **Pricing Engine**: Panel-level calculations
5. **AI Integration**: Update prompts and conversation flow
6. **UI Updates**: Admin and customer-facing changes

## Technical Considerations

- Maintain backward compatibility with single-panel windows
- Consider performance impact of multiple panel queries
- Implement proper panel relationship constraints
- Handle edge cases (max panels, unusual configurations)