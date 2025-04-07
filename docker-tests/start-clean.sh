#!/bin/sh

# Exit on any error
set -e

# Get the directory where the script resides
SCRIPT_DIR=$(dirname "$0")
# Get the parent directory name (should be 'docker-tests')
PARENT_DIR_NAME=$(basename "$SCRIPT_DIR")
VOLUME_NAME="${PARENT_DIR_NAME}_printfarm-data"

# Move to the docker-tests directory
cd "$SCRIPT_DIR"

echo "Stopping any existing services..."
docker compose down --remove-orphans || echo "Compose services not running or already stopped."

echo "Removing existing data volume: $VOLUME_NAME (if it exists)..."
docker volume rm "$VOLUME_NAME" || echo "Volume $VOLUME_NAME not found or already removed."

# Ensure uploads directory exists relative to project root
mkdir -p ../uploads

echo "Building image and starting containers with a fresh volume..."
docker compose up -d --build --force-recreate

echo "------------------------------------"
echo "Clean start complete."
echo "Application running at http://localhost:3000"
echo "View logs: cd docker-tests && docker compose logs -f"
echo "------------------------------------" 