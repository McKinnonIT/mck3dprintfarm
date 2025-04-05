#!/bin/bash

# Exit on any error
set -e

# Move to the project root directory
cd "$(dirname "$0")/.."

# Create a backup of the Dockerfile
echo "Creating a backup of the Dockerfile..."
cp Dockerfile Dockerfile.bak

# No modifications to the Dockerfile - using our optimized version directly
echo "Building Docker image with tag 0.0.3a..."
docker build --no-cache -t mck3dprintfarm:0.0.3a .

# Restore the original Dockerfile from our backup
echo "Restoring the original Dockerfile from backup..."
mv Dockerfile.bak Dockerfile

echo "Docker image built successfully."
echo "Moving to docker-tests directory..."
cd docker-tests

# Make sure uploads directory exists
mkdir -p ../uploads

# If any containers are running from the test compose file, stop them
# BUT preserve volumes by not using the -v flag
echo "Stopping any existing containers from previous runs (preserving volumes)..."
docker-compose down --remove-orphans

# Start the containers with the local image
echo "Starting containers with the local 0.0.3a image..."
docker-compose up -d

echo "Containers started. You can access the application at http://localhost:3000"
echo "View logs with: docker-compose logs -f" 