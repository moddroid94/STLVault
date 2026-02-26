#!/usr/bin/env sh

# Set the exit flag to exit immediately if any command fails
set -e


# Iterate through each environment variable that starts with APP_PREFIX
env | grep "^${TERA_}" | while IFS='=' read -r key value; do
    # Display the variable being replaced
    echo "  • Replacing ${key} → ${value}"

    # Use find and sed to replace the variable in all files within the directory
    find "/app" -type f -name 'vite.config.ts' \
        -exec sed -i "s|${key}|${value}|g" {} +
done