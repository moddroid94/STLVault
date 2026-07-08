#!/bin/sh
# Replace placeholders in JS files with actual env vars
for i in $(env | grep '^TERA_'); do
  key=$(echo $i | cut -d '=' -f 1)
  value=$(echo $i | cut -d '=' -f 2-)
  echo "Replacing static $key with $value"
  find /app/dist -type f -name '*.js' -exec sed -i "s|${key}|${value}|g" '{}' +
done
exec serve -s dist -l 5173