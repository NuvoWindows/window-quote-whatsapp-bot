#!/bin/bash
# Install git hooks for auto-pushing

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create post-commit hook - ensure we use LF line endings
cat > .git/hooks/post-commit << 'EOF'
#!/bin/sh
# Auto-push after commit

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Log what's happening
echo "Auto-pushing changes to $BRANCH..."

# Push to the same branch
git push origin $BRANCH

# Show success message
echo "✅ Successfully pushed to $BRANCH"
EOF

# Convert Windows line endings (CRLF) to Unix (LF) if necessary
if command -v dos2unix > /dev/null; then
    dos2unix .git/hooks/post-commit
else
    sed -i 's/\r$//' .git/hooks/post-commit
fi

# Make hook executable
chmod +x .git/hooks/post-commit

echo "Git hooks installed successfully!"
echo "Now your commits will be automatically pushed to GitHub."