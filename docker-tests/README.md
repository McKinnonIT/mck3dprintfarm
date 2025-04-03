# Docker Testing Environment

This directory contains scripts and configuration for testing locally built Docker images of the 3D Print Farm application.

## Contents

- `docker-compose.yml` - Modified Docker Compose configuration that uses the locally built image
- `build-and-run.sh` - Script to build a local image with tag `0.0.2a` and start the containers
- `stop.sh` - Script to stop the running containers

## Usage

### Building and Running

To build the Docker image with the `0.0.2a` tag and start the application:

```bash
# Make sure you're in the docker-tests directory
cd docker-tests

# Run the build and start script
./build-and-run.sh
```

The script will:
1. Build a Docker image from the current codebase with tag `0.0.2a`
2. Create the necessary directories
3. Start the containers using docker-compose

The application will be accessible at http://localhost:3000.

### Stopping the Application

To stop the running containers:

```bash
./stop.sh
```

## Notes

- The `uploads` directory is mounted from the parent directory to ensure persistent storage
- The database is stored in a Docker volume for persistence between container restarts
- Environment variables can be modified in the `docker-compose.yml` file 