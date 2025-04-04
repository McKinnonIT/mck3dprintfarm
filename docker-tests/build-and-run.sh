#!/bin/bash

# Exit on any error
set -e

# Move to the project root directory
cd "$(dirname "$0")/.."

echo "Modifying Dockerfile to include moonraker-api Python package..."
# Use sed to modify the Dockerfile to add moonraker-api
# Find the line that installs prusaLinkPy and add moonraker-api
# Check if we're on macOS or Linux (different sed syntax)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS version
  sed -i '' -e 's#/app/venv/bin/pip install prusaLinkPy#/app/venv/bin/pip install prusaLinkPy moonraker-api#g' Dockerfile
else
  # Linux version
  sed -i -e 's#/app/venv/bin/pip install prusaLinkPy#/app/venv/bin/pip install prusaLinkPy moonraker-api#g' Dockerfile
fi

echo "Building Docker image with tag 0.0.3a..."
docker build -t mck3dprintfarm:0.0.3a .

# Restore the original Dockerfile (so we don't commit the change)
git checkout -- Dockerfile

echo "Docker image built successfully."
echo "Moving to docker-tests directory..."
cd docker-tests

# Make sure uploads directory exists
mkdir -p ../uploads

# If any containers are running from the test compose file, stop them
echo "Stopping any existing containers from previous runs..."
docker-compose down

# Start the containers with the local image
echo "Starting containers with the local 0.0.3a image..."
docker-compose up -d

echo "Containers started. You can access the application at http://localhost:3000"
echo "View logs with: docker-compose logs -f" 