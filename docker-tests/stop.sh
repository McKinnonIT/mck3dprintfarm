#!/bin/bash

# Move to the docker-tests directory
cd "$(dirname "$0")"

echo "Stopping Docker containers..."
docker-compose down

echo "Containers stopped." 