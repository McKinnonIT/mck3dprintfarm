#!/bin/sh

# Exit on any error
set -e

# Define image name and tag
IMAGE_TAG="mck3dprintfarm:v0.0.4a"

# Move to the project root directory (parent of the script's dir)
cd "$(dirname "$0")/.."

echo "Building Docker image: $IMAGE_TAG ..."
docker build -t "$IMAGE_TAG" .

echo "------------------------------------"
echo "Image build complete: $IMAGE_TAG"
echo "------------------------------------" 