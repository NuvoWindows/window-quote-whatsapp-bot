# Claude's Development Guidelines

This document helps me (Claude) maintain consistent development practices throughout our work on this project.

## Git Workflow

### When to Commit
- After completing each task or significant subtask
- After implementing a new feature or fixing a bug
- After writing/updating tests
- After updating documentation
- Before switching to a different area of work

### When to Push
- After completing a logical unit of work (feature, bugfix, or task)
- Before ending a work session
- After achieving a stable state where tests pass
- When requested by the user

### Commit Message Format
```
<type>: <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions/modifications
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

Example:
```
feat: Add retry mechanism to WhatsApp service

- Implement exponential backoff with jitter
- Add configurable retry parameters
- Integrate with existing error handling
```

## Development Workflow

### Before Starting New Work
1. Check git status to ensure clean working directory
2. Pull latest changes if working after a break
3. Run tests to ensure starting from stable state
4. Review todo list to understand priorities

### During Development
1. Write tests for new features when applicable
2. Run related tests frequently during development
3. Keep changes focused on the current task
4. Update documentation alongside code changes

### After Completing Work
1. Run all tests to ensure nothing is broken
2. Run linting if available (npm run lint)
3. Update relevant documentation
4. Commit with clear, descriptive message
5. Push changes to remote repository

## Testing Guidelines

### Test Running Commands
- Run all tests: `npm test`
- Run specific test file: `npm test -- <filename>`
- Run tests in watch mode: `npm test -- --watch`

### When to Run Tests
- Before starting work (baseline check)
- After implementing feature (verify it works)
- Before committing (ensure stability)
- After fixing failing tests

## Code Quality Checks

### Before Committing
- [ ] Tests pass (or document why they don't)
- [ ] Code follows existing patterns in codebase
- [ ] No console.logs left in production code
- [ ] Error handling is appropriate
- [ ] Documentation is updated if needed

### Before Pushing
- [ ] All commits have meaningful messages
- [ ] No sensitive data in commits
- [ ] Tests are passing or issues are documented
- [ ] Related documentation is updated

## Decision Making

### When Adding New Features
1. Check if similar functionality exists
2. Follow existing patterns in the codebase
3. Consider error handling from the start
4. Write tests alongside implementation
5. Update documentation immediately

### When Fixing Bugs
1. Write a failing test that reproduces the bug
2. Fix the bug
3. Ensure the test now passes
4. Check for similar issues elsewhere

### When Refactoring
1. Ensure tests exist for current functionality
2. Make incremental changes
3. Run tests after each change
4. Commit working states frequently

## Project-Specific Reminders

### For This WhatsApp Bot Project
- Always check message parser when modifying quote logic
- Test with various window specifications
- Consider conversation context in all changes
- Remember error handling and recovery flows
- Update API documentation for new endpoints
- Consider impact on existing conversations

### Common Commands
```bash
# Start development server
npm run dev

# Run tests
npm test

# Run specific test file
npm test -- src/__tests__/services/quoteService.test.js

# Check for linting issues
npm run lint

# Start production server
npm start
```

## Documentation Updates

### Always Update
- API documentation when adding/modifying endpoints
- Service documentation when adding new services
- README when adding new features or setup steps
- Architecture docs for significant changes

### Review Periodically
- ROADMAP.md for completed tasks
- This file (CLAUDE.md) for new learnings
- Test coverage for gaps

## Avoiding Duplication and Overlap

### Before Creating New Code
1. Search for existing similar functionality:
   - Use grep/search for keywords
   - Check related services and utilities
   - Look for shared extractors or validators
2. Consider if existing code can be:
   - Extended rather than duplicated
   - Refactored into a shared utility
   - Used as-is with minor modifications

### Examples in This Project
- Use `sharedExtractors.js` for any window parsing logic
- Use `RetryUtil` for any retry needs (don't implement custom retry logic)
- Use `ErrorMonitoringService` for error tracking (don't create new error logs)
- Use `SpecificationValidator` for validation (don't duplicate validation logic)

## Simple Debugging Workflow

### When Something Isn't Working
1. Check the logs first (error messages often point to the issue)
2. Run the specific failing test in isolation
3. Add temporary console.logs to trace the flow
4. Check if similar code works elsewhere in the project
5. Remove debug code before committing

## Notes for Future Sessions

- Remember: User relies on me for git workflow decisions
- Always proactively manage todos and track progress