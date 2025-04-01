FROM node:18-alpine

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

# Install PrusaLinkPy in a proper way for Alpine
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install prusaLinkPy

# Create uploads directory
RUN mkdir -p uploads

# Create startup script
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'source /app/venv/bin/activate' >> /app/docker-entrypoint.sh && \
    echo 'node /app/scripts/create-admin-user.js' >> /app/docker-entrypoint.sh && \
    echo 'NODE_TLS_REJECT_UNAUTHORIZED=0 next dev' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Start the application using our custom entrypoint
CMD ["/app/docker-entrypoint.sh"] 