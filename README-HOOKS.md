# Git Hook for Auto-Pushing

This repository includes a git hook that automatically pushes your commits to GitHub. This eliminates the need to manually run `git push` after each commit.

## Setup Instructions

Run the following command to install the hooks:

```bash
npm run install-hooks
```

## How It Works

After installation, the hook will:
1. Automatically run after each commit
2. Push changes to the current branch
3. Show a confirmation message

## Troubleshooting

If the auto-push fails (e.g., due to connectivity issues), you can always push manually:

```bash
git push origin <branch-name>
```

## Disabling the Hook

If you want to temporarily disable the automatic pushing:

```bash
mv .git/hooks/post-commit .git/hooks/post-commit.disabled
```

To re-enable it:

```bash
mv .git/hooks/post-commit.disabled .git/hooks/post-commit
```