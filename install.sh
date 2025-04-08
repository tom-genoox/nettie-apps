#!/bin/bash

# Root installation script for Nettie CLI tools

echo "Installing Nettie CLI tools..."

# Navigate to the CLI utilities directory
cd utilities/cli

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is required but not installed."
    echo "Please install Bun first: https://bun.sh"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
bun install

# Link the package globally
echo "Linking package globally..."
bun link

echo ""
echo "✅ Nettie CLI installed successfully!"
echo ""
echo "You can now use the following commands:"
echo "  - nettie: Main CLI tool with all commands"
echo "  - nettie create: Create new Nettie apps and utilities"
echo ""
echo "For more information, run: nettie --help"

# Return to the original directory
cd ../../ 