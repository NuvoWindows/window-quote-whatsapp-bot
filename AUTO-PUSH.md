# Auto-Push for Windows Users

This project includes convenient npm scripts to simplify git operations. This makes the workflow much simpler, especially on Windows.

## How to Use

Instead of using the normal Git commands, use these npm scripts:

```bash
# To add all files and commit with a message
npm run commit "Your commit message here"

# To push your committed changes
npm run push

# To commit and push in one step (add, commit, push)
npm run cp "Your commit message here"
```

## Examples

```bash
# Just commit
npm run commit "Update AI prompt with improved conversation flow"

# Just push
npm run push

# Commit and push in one step
npm run cp "Fix Claude API authentication error handling"
```

## Benefits

- Works reliably on Windows with SSH authentication
- Simple to use
- No need to manually run multiple Git commands
- Integrated with npm scripts
- Uses native Git commands for maximum compatibility