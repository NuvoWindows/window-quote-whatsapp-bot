# Auto-Push for Windows Users

For Windows users, we've set up a special Git alias that allows you to commit and push in a single command.

## How to Use

Instead of using the normal `git commit` command, use this:

```bash
git autopush "Your commit message here"
```

This will:
1. Create a commit with your message
2. Automatically push to the current branch

## Example

```bash
# Add your files
git add .

# Commit and push in one step
git autopush "Update AI prompt with improved conversation flow"
```

## Benefits

- Works reliably on Windows systems
- No need for executable scripts
- Simple to use
- No need to manually push after commits

## If the Alias Isn't Working

If the `git autopush` command isn't available, you can set it up with:

```bash
git config --global alias.autopush '!git commit -m "$1" && git push origin HEAD'
```