#!/bin/sh
# Replace placeholders in JS files with actual env vars
for i in $(env | grep '^TERA_'); do
  key=$(echo $i | cut -d '=' -f 1)
  value=$(echo $i | cut -d '=' -f 2-)
  echo "Replacing $key with $value"
  find /app -type f -name 'vite.config.ts' -exec sed -i "s|${key}|${value}|g" '{}' +
done   