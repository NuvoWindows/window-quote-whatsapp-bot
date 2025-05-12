# Auto-Push for Windows Users

This project includes a convenient script to commit and push in a single command. This makes the workflow much simpler.

## How to Use

Instead of using the normal Git commands, use the npm script:

```bash
npm run push "Your commit message here"
```

This will:
1. Add all your changes
2. Create a commit with your message
3. Automatically push to the current branch

## Example

```bash
# Commit and push in one step
npm run push "Update AI prompt with improved conversation flow"
```

## Benefits

- Works reliably on all systems (Windows, Mac, Linux)
- Simple to use
- No need to manually run multiple Git commands
- Integrated with npm scripts

## Manual Method

If you prefer, you can also run the script directly:

```bash
./autopush.sh "Your commit message here"
```