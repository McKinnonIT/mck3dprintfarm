# Use Node.js 18 Alpine as the base image for the build stage
FROM node:22-alpine3.19 AS builder

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies properly and ensure UI libraries are available
RUN npm ci && \
    npm cache clean --force

# Copy the source code
COPY . .

# Generate Prisma client (after copying schema)
RUN npx prisma generate

# Remove the potentially populated database file before copying
# RUN rm -f /app/prisma/dev.db || true

# Create a special .env file for the build process
RUN echo "NEXT_PUBLIC_BUILD_ENV=production" > .env

# Set NODE_ENV to production for the build
ENV NODE_ENV=production

# Clear Next.js cache before building
RUN rm -rf .next

# Build the Next.js application
RUN npm run build && npm prune --production && npm cache clean --force

# Production image - use a smaller footprint
FROM node:22-alpine3.19 AS runner

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

# Install sqlite3 for direct db access, ffmpeg for grabbing camera
# snapshot frames from HLS streams, plus Python for the Bambu Lab
# bridge (the only remaining printer integration that still needs it -
# PrusaLink and Moonraker talk native HTTP now, no Python required).
RUN apk add --no-cache sqlite && \
    apk add --no-cache ffmpeg && \
    apk add --no-cache python3 py3-pip && \
    mkdir -p /tmp/npm-tmp && \
    npm config set cache /tmp/npm-tmp && \
    npm install -g prisma --no-optional && \
    npm install bcryptjs && \
    pip3 install --break-system-packages --upgrade bambulabs_api && \
    rm -rf /tmp/npm-tmp

# Copy the new script and make it executable
COPY prisma/run-ensure-tables.sh /app/prisma/run-ensure-tables.sh
RUN chmod +x /app/prisma/run-ensure-tables.sh

# Create startup script with improved Prisma migration handling and conditional SQL execution
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo 'echo "Running Prisma generate with local schema..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && npx prisma generate' >> /app/docker-entrypoint.sh && \
    # Use migrate deploy to apply migrations safely
    echo 'echo "Applying Prisma migrations..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && npx prisma migrate deploy' >> /app/docker-entrypoint.sh && \
    echo 'echo "Checking if initial table setup is needed..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && sh /app/prisma/run-ensure-tables.sh' >> /app/docker-entrypoint.sh && \
    echo 'echo "Checking and creating admin user if needed..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && node scripts/create-admin-user.js' >> /app/docker-entrypoint.sh && \
    # Sync any printer camera URLs missing a camera-proxy path (e.g. after
    # upgrading from a version predating the sidecar). Non-fatal, so a
    # not-yet-ready sidecar doesn't block the app from starting.
    echo 'echo "Syncing printer camera paths with camera-proxy..."' >> /app/docker-entrypoint.sh && \
    echo 'cd /app && node scripts/backfill-camera-paths.js || true' >> /app/docker-entrypoint.sh && \
    echo 'echo "Starting application..."' >> /app/docker-entrypoint.sh && \
    echo 'node server.js' >> /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Start the application
ENTRYPOINT ["/app/docker-entrypoint.sh"] 
