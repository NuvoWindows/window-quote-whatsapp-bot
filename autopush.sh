#!/bin/bash
# Automatically commit and push in one command

# Check if a commit message was provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide a commit message"
    echo "Usage: ./autopush.sh \"Your commit message\""
    exit 1
fi

# Add all changes
git add .

# Commit with the provided message
git commit -m "$1"

# Push to the current branch
git push origin $(git rev-parse --abbrev-ref HEAD)

echo "✅ Changes committed and pushed successfully!"