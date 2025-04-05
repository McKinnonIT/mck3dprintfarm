#!/bin/bash

# Exit on any error
set -e

# Move to the project root directory
cd "$(dirname "$0")/.."

# Configuration - Change these as needed
DOCKER_HUB_USERNAME="alastairtech"  # Change to your Docker Hub username 
IMAGE_NAME="mck3dprintfarm"

# Get current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)
VERSION=$(grep '"version"' package.json | cut -d '"' -f 4)

# Check if branch name already contains the version
if [[ "$BRANCH" == *"$VERSION"* ]]; then
  # If branch already contains version, just use the branch name
  TAG="${BRANCH}"
else
  # Otherwise use the original format
  TAG="${VERSION}-${BRANCH}"
fi

echo "=========================================================="
echo "Building and pushing Docker image from the local environment"
echo "=========================================================="
echo "Image: ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}"
echo "Tag: ${TAG}"
echo "Version from package.json: ${VERSION}"
echo "Branch: ${BRANCH}"
echo "=========================================================="

# Ask for confirmation
read -p "Continue with build and push? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 1
fi

# Create a backup of the Dockerfile (following the same pattern as build-and-run.sh)
echo "Creating a backup of the Dockerfile..."
cp Dockerfile Dockerfile.bak

# Build the Docker image using the same process as the test script
echo "Building Docker image with tag ${TAG}..."
docker build --no-cache -t ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${TAG} .

# Also tag as "latest"
echo "Tagging image as latest..."
docker tag ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${TAG} ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:latest

# Restore the original Dockerfile from our backup
echo "Restoring the original Dockerfile from backup..."
mv Dockerfile.bak Dockerfile

# Log in to Docker Hub
echo "Logging in to Docker Hub..."
echo "Please enter your Docker Hub password when prompted:"
docker login -u ${DOCKER_HUB_USERNAME}

# Push the image to Docker Hub
echo "Pushing image to Docker Hub as ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${TAG}..."
docker push ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${TAG}

echo "Pushing image to Docker Hub as ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:latest..."
docker push ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:latest

echo "=========================================================="
echo "Build and push complete!"
echo "Images pushed to Docker Hub:"
echo "- ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${TAG}"
echo "- ${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:latest"
echo "==========================================================" 