#!/bin/sh

# Exit on any error
set -e

# Move to the docker-tests directory
cd "$(dirname "$0")"

echo "Stopping containers (if running) without removing volumes..."
docker compose down --remove-orphans || echo "Compose services not running or already stopped."

echo "Starting containers, rebuilding image if code changed, using existing data volume..."
echo "(Applying pending migrations if any)"
# Add --build and --force-recreate to handle image updates
docker compose up -d --build --force-recreate

echo "------------------------------------"
echo "Persistent start complete."
echo "Application running at http://localhost:3000"
echo "View logs: cd docker-tests && docker compose logs -f"
echo "------------------------------------" 