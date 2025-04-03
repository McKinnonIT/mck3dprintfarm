#!/bin/bash

# Exit on any error
set -e

# Move to the project root directory
cd "$(dirname "$0")/.."

echo "Building Docker image with tag 0.0.2a..."
docker build -t mck3dprintfarm:0.0.2a .

echo "Docker image built successfully."
echo "Moving to docker-tests directory..."
cd docker-tests

# Make sure uploads directory exists
mkdir -p ../uploads

# If any containers are running from the test compose file, stop them
echo "Stopping any existing containers from previous runs..."
docker-compose down

# Start the containers with the local image
echo "Starting containers with the local 0.0.2a image..."
docker-compose up -d

echo "Containers started. You can access the application at http://localhost:3000"
echo "View logs with: docker-compose logs -f" 