#!/bin/sh

# Exit on any error
set -e

# Move to the docker-tests directory to ensure compose commands work
cd "$(dirname "$0")"

echo "Stopping compose services (if running)..."
docker-compose down --remove-orphans || echo "Compose services not running or already stopped."

# Remove the host database file used by the bind mount
echo "Removing host database file ./database/dev.db ..."
rm -f ./database/dev.db || echo "Host database file not found or already removed."

# Ensure the host database directory exists for the next run
mkdir -p ./database

# Move back to project root for other docker commands
cd ..

# Stop and remove all containers (redundant but safe)
containers=$(docker ps -aq)
if [ -n "$containers" ]; then
  echo "Stopping remaining containers..."
  docker stop $containers
  echo "Removing remaining containers..."
  docker rm $containers
fi

# Remove all images
images=$(docker images -q)
if [ -n "$images" ]; then
  echo "Removing images..."
  docker rmi $images
fi

# Remove docker volumes (optional, as we are not using named volumes for DB anymore)
echo "Attempting to remove old volume mck3dprintfarm_data (if it exists)..."
docker volume rm mck3dprintfarm_data || echo "Volume mck3dprintfarm_data not found or already removed."

volumes=$(docker volume ls -q)
if [ -n "$volumes" ]; then
  echo "Removing any other remaining volumes..."
  docker volume rm $volumes || echo "Some remaining volumes could not be removed (might be in use or already gone)."
fi

# Prune the system to remove unused data
echo "Pruning Docker system..."
docker system prune -a --volumes -f

echo "Cleanup script finished."

# Remove any specific bind mounts or directories if needed
# rm -rf /path/to/bind/mount

# Rebuild the Docker environment if needed
# docker-compose up --build

# Note: Uncomment the rebuild line if you want to automatically rebuild the environment after cleaning. 