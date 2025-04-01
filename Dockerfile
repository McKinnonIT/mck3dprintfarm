FROM node:18-alpine AS builder

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Install additional dependencies that might be missing
RUN npm install lucide-react @radix-ui/react-icons

# Copy prisma schema
COPY prisma ./prisma/

# Copy rest of the app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# Production image, copy all the files and run next
FROM node:18-alpine AS runner

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Create uploads directory
RUN mkdir -p uploads

# Install Python requirements
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install prusaLinkPy

# Copy built assets from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tailwind.config.js ./
COPY --from=builder /app/postcss.config.js ./

# Create startup script
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'source /app/venv/bin/activate' >> /app/docker-entrypoint.sh && \
    echo 'node /app/scripts/create-admin-user.js' >> /app/docker-entrypoint.sh && \
    echo 'npm run start' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Set environment variable for production
ENV NODE_ENV=production

# Start the application
CMD ["/app/docker-entrypoint.sh"] 