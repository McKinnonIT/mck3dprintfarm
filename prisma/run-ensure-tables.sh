#!/bin/sh
set -e

# Use a marker file location INSIDE the persistent volume
MARKER_FILE="/app/data/.initialized"
DB_SCHEMA_PATH="./prisma/schema.prisma"
ENSURE_TABLES_SQL="./prisma/ensure_tables.sql"

# Check if schema.prisma exists
if [ ! -f "$DB_SCHEMA_PATH" ]; then
  echo "Error: Prisma schema file not found at $DB_SCHEMA_PATH"
  exit 1
fi

# Extract DB path relative to the prisma directory
DB_PATH_RELATIVE=$(grep -o 'url *= *"[^"]*"' "$DB_SCHEMA_PATH" | head -n 1 | sed -n 's/.*"file:\(.\+\)"/\1/p')

if [ -z "$DB_PATH_RELATIVE" ]; then
    echo "Error: Could not extract database path from $DB_SCHEMA_PATH"
    exit 1
fi

DB_FULL_PATH="/app/data/dev.db" # Assuming this is the correct path based on schema

echo "Checking for marker file: $MARKER_FILE"
if [ ! -f "$MARKER_FILE" ]; then
  echo "First run marker not found. Checking for database file: $DB_FULL_PATH"
  if [ -f "$DB_FULL_PATH" ]; then
    echo "Database file found. Running $ENSURE_TABLES_SQL..."
    if sqlite3 "$DB_FULL_PATH" < "$ENSURE_TABLES_SQL"; then
      echo "SQL script executed successfully. Creating marker file $MARKER_FILE..."
      touch "$MARKER_FILE"
      echo "Marker file created."
    else
      echo "Error executing SQL script $ENSURE_TABLES_SQL on $DB_FULL_PATH."
      exit 1 
    fi
  else
    echo "Database file does not exist at $DB_FULL_PATH. Skipping SQL execution and marker file creation."
  fi
else
  echo "Marker file found at $MARKER_FILE. Skipping SQL execution."
fi

exit 0 