FROM node:18-alpine

WORKDIR /app

# Install git
RUN apk add --no-cache git

# Clean workspace and clone the repository
RUN rm -rf * && git clone --depth 1 https://github.com/GridSpace/grid-apps.git . && \
    npm run setup

# Create a start script file
RUN printf '#!/bin/sh\nexport KIRI_ALLOW_ORIGIN="http://localhost:3000"\nexport KIRI_SIMPLE_UI="true"\nexport KIRI_NO_ANALYTICS="true"\nexport KIRI_WS=true\nexport KIRI_CORS=true\nexport KIRI_FRAME_ANCESTORS="http://localhost:3000"\nexport KIRI_HEADERS={"Access-Control-Allow-Origin":"http://localhost:3000","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization","Content-Security-Policy":"frame-ancestors '\''self'\'' http://localhost:3000","X-Frame-Options":"ALLOW-FROM http://localhost:3000"}\nif [ "$NODE_ENV" = "production" ]; then\n  /app/node_modules/.bin/gs-app-server --api --allow-upload --upload-dir=/app/uploads --ws --cors\nelse\n  /app/node_modules/.bin/gs-app-server --debug --api --allow-upload --upload-dir=/app/uploads --ws --cors\nfi\n' > /app/start.sh

# Make it executable
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 8080

# Set environment variables for simpler UI
ENV KIRI_SIMPLE_UI=true
ENV KIRI_NO_ANALYTICS=true
ENV KIRI_ALLOW_ORIGIN=http://localhost:3000
ENV KIRI_CORS=true
ENV KIRI_FRAME_ANCESTORS=http://localhost:3000

# Start the server with our script
CMD ["/app/start.sh"] 