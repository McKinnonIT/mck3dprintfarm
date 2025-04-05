#!/bin/bash

# Exit on error
set -e

echo "Building Docker image with Bambu Lab support..."
docker build --no-cache -t mck3dprintfarm:local .

echo "Creating docker-compose.local.yml for local image..."
cat > docker-compose.local.yml << EOF
version: '3'

services:
  mck3dprintfarm:
    image: mck3dprintfarm:local
    command: >
      sh -c "
        echo 'Initializing database...' &&
        mkdir -p /app/prisma &&
        echo 'Creating empty database if it does not exist...' &&
        if [ ! -f /app/prisma/dev.db ]; then
          touch /app/prisma/dev.db
          echo 'Created new database file'
        else
          echo 'Database file already exists'
        fi &&
        echo 'Generating Prisma client...' &&
        npx prisma generate &&
        echo 'Running Prisma db push to create tables directly...' &&
        npx prisma db push --accept-data-loss &&
        echo 'Database schema created.' &&
        echo 'Checking and creating admin user if needed...' &&
        node scripts/create-admin-user.js &&
        echo 'Starting application...' &&
        npm start
      "
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
      # Don't mount the entire prisma directory, just create data volume for persistence
      - mck3dprintfarm_data:/app/prisma
      # Avoid mounting certificates since we're skipping HTTPS in dev mode in Docker
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      # Skip HTTPS for Docker deployment
      - NEXTAUTH_URL=http://localhost:3000
      # NextAuth secret for JWT encryption and session security
      - NEXTAUTH_SECRET=your-super-secret-random-string-here-please-change-this
      # Database connection - fixed path for Docker
      - DATABASE_URL=file:/app/prisma/dev.db
      # Default admin user credentials
      - DEFAULT_ADMIN_EMAIL=admin@example.com
      - DEFAULT_ADMIN_PASSWORD=Admin123!
      - DEFAULT_ADMIN_NAME=Administrator
      # Add other environment variables as needed

# Named volumes for data persistence
volumes:
  mck3dprintfarm_data:
EOF

echo "Running with local image using docker-compose.local.yml..."
docker-compose -f docker-compose.local.yml up -d

echo "Container is starting at http://localhost:3000"
echo "Admin credentials: admin@example.com / Admin123!" 