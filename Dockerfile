# Use Node.js 18 Alpine as the base image for the build stage
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies properly and ensure UI libraries are available
RUN npm ci && \
    npm cache clean --force

# Copy the source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create a special .env file for the build process
RUN echo "NEXT_PUBLIC_BUILD_ENV=production" > .env

# Set NODE_ENV to production for the build
ENV NODE_ENV=production

# Build the Next.js application
RUN npm run build && npm prune --production && npm cache clean --force

# Production image - use a smaller footprint
FROM node:18-alpine AS runner

WORKDIR /app

# Create uploads directory
RUN mkdir -p uploads

# Set environment variables
ENV DOCKER_ENV=true
ENV NODE_ENV=production

# Copy only what's needed from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/package.json ./package.json

# Install necessary tools including sqlite3 for direct db access
RUN apk add --no-cache sqlite && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    mkdir -p /tmp/npm-tmp && \
    npm config set cache /tmp/npm-tmp && \
    npm install -g prisma --no-optional && \
    npm install bcryptjs && \
    apk del .gyp && \
    rm -rf /tmp/npm-tmp

# Create startup script with improved Prisma migration handling
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo 'echo "Running Prisma generate with local schema..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && npx prisma generate' >> /app/docker-entrypoint.sh && \
    echo 'echo "Checking if database exists and is initialized..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && npx prisma db push --accept-data-loss --skip-generate' >> /app/docker-entrypoint.sh && \
    echo 'echo "Applying migrations if needed..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && npx prisma migrate deploy --schema=./prisma/schema.prisma' >> /app/docker-entrypoint.sh && \
    echo 'echo "Directly creating tables with SQLite..."' >> /app/docker-entrypoint.sh && \
    echo 'DB_PATH=$(grep -o "file:.*" ./prisma/schema.prisma | cut -d\" -f2)' >> /app/docker-entrypoint.sh && \
    echo 'echo "Database path: $DB_PATH"' >> /app/docker-entrypoint.sh && \
    echo 'if [ -f "./prisma/$DB_PATH" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "Database file exists, executing ensure_tables.sql..."' >> /app/docker-entrypoint.sh && \
    echo '  sqlite3 "./prisma/$DB_PATH" < ./prisma/ensure_tables.sql' >> /app/docker-entrypoint.sh && \
    echo 'else' >> /app/docker-entrypoint.sh && \
    echo '  echo "Database file does not exist at ./prisma/$DB_PATH"' >> /app/docker-entrypoint.sh && \
    echo '  ls -la ./prisma/' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'echo "Creating admin user if needed..."' >> /app/docker-entrypoint.sh && \
    echo 'node /app/scripts/create-admin-user.js' >> /app/docker-entrypoint.sh && \
    echo 'echo "Starting server..."' >> /app/docker-entrypoint.sh && \
    echo 'node server.js' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Start the application
CMD ["/app/docker-entrypoint.sh"] 