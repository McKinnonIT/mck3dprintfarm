#!/bin/bash

# Script to build and deploy the MCK 3D Print Farm Docker image

# Exit on any error
set -e

# Default values
DOCKER_USERNAME=""
TAG="latest"
PUSH_TO_HUB=false

# Functions
show_help() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -u, --username     Docker Hub username (required for push)"
  echo "  -t, --tag          Image tag (default: latest)"
  echo "  -p, --push         Push to Docker Hub"
  echo "  -h, --help         Show this help message"
  exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -u|--username)
      DOCKER_USERNAME="$2"
      shift 2
      ;;
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -p|--push)
      PUSH_TO_HUB=true
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      ;;
  esac
done

# Build the Docker image
echo "Building Docker image mck3dprintfarm:$TAG..."
docker build -t mck3dprintfarm:$TAG .

if [ "$PUSH_TO_HUB" = true ]; then
  if [ -z "$DOCKER_USERNAME" ]; then
    echo "Error: Docker Hub username is required for push. Use -u or --username."
    exit 1
  fi
  
  # Tag the image for Docker Hub
  echo "Tagging image as $DOCKER_USERNAME/mck3dprintfarm:$TAG"
  docker tag mck3dprintfarm:$TAG $DOCKER_USERNAME/mck3dprintfarm:$TAG
  
  # Push to Docker Hub
  echo "Pushing image to Docker Hub..."
  docker push $DOCKER_USERNAME/mck3dprintfarm:$TAG
  
  echo "Image pushed successfully to Docker Hub as $DOCKER_USERNAME/mck3dprintfarm:$TAG"
else
  echo "Docker image built successfully. To push to Docker Hub, run with --push and --username options."
fi

echo "Done!" 