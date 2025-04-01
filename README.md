# MCK 3D Print Farm Manager

A web-based application for managing 3D printers at McKinnon Secondary College. This application provides a dashboard for monitoring and controlling both PrusaLink and Moonraker-based 3D printers.

## Features

- Real-time monitoring of 3D printer status
- Support for both PrusaLink and Moonraker (Klipper) printers
- File uploading and management
- Print job tracking
- Printer grouping for organizational management
- User authentication and role-based access control
- Webcam integration for remote monitoring

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: SQLite (default), compatible with PostgreSQL
- **Authentication**: NextAuth.js
- **3D Printer Integration**: PrusaLinkPy, Moonraker API

## Deployment Options

### Docker Deployment

The application is available as a Docker image that can be pulled from Docker Hub:

```bash
docker pull yourusername/mck3dprintfarm:latest
```

Or use a specific version:

```bash
docker pull yourusername/mck3dprintfarm:1.0.0
```

#### Docker Run

```bash
docker run -p 3000:3000 -v ./data:/app/data yourusername/mck3dprintfarm:latest
```

#### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  mck3dprintfarm:
    image: yourusername/mck3dprintfarm:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

### Manual Deployment

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install PrusaLinkPy:
   ```bash
   pip install prusaLinkPy
   ```
4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
5. Build the application:
   ```bash
   npm run build
   ```
6. Start the server:
   ```bash
   npm run start
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```
# Database URL
DATABASE_URL="file:./data/dev.db"

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
```

## GitHub Actions

The repository is configured with GitHub Actions to automatically build and push the Docker image to Docker Hub when changes are pushed to the main branch.

### Required Secrets

To use the GitHub Actions workflow, you need to add the following secrets to your GitHub repository:

- `DOCKERHUB_USERNAME`: Your Docker Hub username
- `DOCKERHUB_TOKEN`: Your Docker Hub token (create one in Docker Hub account settings)

## License

This software was developed for McKinnon Secondary College and is provided as-is.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 
MIT 