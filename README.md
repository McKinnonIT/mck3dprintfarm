# MCK 3D Print Farm

A web application for managing a farm of 3D printers.

## Features

- User authentication
- Printer management
- File upload and management
- Print job tracking
- Print history and analytics

## Printer Support

### Prusa Link Printers

For Prusa printers using PrusaLink, the application uses the PrusaLinkPy Python library to provide a reliable and stable connection. This approach simplifies file uploads and print job management.

#### Requirements for PrusaLink Integration

1. Python 3.6 or newer must be installed on your system
2. The PrusaLinkPy library must be installed:
   ```
   pip install prusaLinkPy
   ```

The application is designed to work with various Python setups:

- Automatically detects Python executables (`python3`, `python`, or `py`)
- Supports both direct `pip` and `python -m pip` installation methods
- Provides a user-friendly setup interface at `/dashboard/prusalink-setup`

#### Diagnostic Tools

The application includes several tools to help diagnose issues with PrusaLink printers:

- **Dependency Check**: Verify Python and PrusaLinkPy are installed at `/dashboard/prusalink-setup`
- **API Diagnostic**: Test direct communication with your printer at `/dashboard/printers/[id]/prusalink-diagnostic`
- **Command-line Test Script**: Use the included test script for troubleshooting uploads

To use the command-line test script:

```bash
node scripts/test-prusalink-upload.js <printer-ip> <api-key> <file-path> [print]

# Examples:
node scripts/test-prusalink-upload.js 192.168.1.123 abcd1234 path/to/file.bgcode
node scripts/test-prusalink-upload.js 192.168.1.123 abcd1234 path/to/file.bgcode print
```

#### Automatic Dependency Check

The application includes endpoints to check and install required dependencies:

- `/api/printers/check-dependencies` - Checks if Python and PrusaLinkPy are installed
- `/api/printers/install-dependencies` - Attempts to install or update the PrusaLinkPy library

If you have PrusaLink printers, you'll see a notification in the printers dashboard that guides you to the setup page.

## Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (see `.env.example`)
4. Run the development server:
   ```
   npm run dev
   ```

### Database

This project uses Prisma ORM with a SQLite database for development. To set up the database:

```
npx prisma generate
npx prisma migrate dev
```

## Deployment

### Standard Deployment

1. Build the application:
   ```
   npm run build
   ```
2. Start the server:
   ```
   npm start
   ```

### Docker Deployment

This application can be run using Docker, which simplifies deployment and ensures consistent environments.

#### Prerequisites

- Docker and Docker Compose installed on your system
- Docker Hub account (for pushing to Docker Hub)

#### Using Docker Compose (Recommended)

1. Clone the repository
2. Configure your environment variables in a `.env` file
3. Build and start the application:
   ```
   docker-compose up -d
   ```

This will:
- Build the Docker image
- Start the container
- Map port 3000 to your host
- Mount the uploads directory and database file for persistence
- Create a default admin user (if one doesn't exist)

#### Default Admin User

By default, the Docker container will create an admin user on first startup if one doesn't exist:

- Email: admin@example.com
- Password: Admin123!
- Name: Administrator

You can customize these values by setting the following environment variables in your `.env` file or in the `docker-compose.yml`:

```
DEFAULT_ADMIN_EMAIL=your_email@example.com
DEFAULT_ADMIN_PASSWORD=your_secure_password
DEFAULT_ADMIN_NAME=Your Name
```

#### Manual Docker Build and Run

1. Build the Docker image:
   ```
   docker build -t mck3dprintfarm .
   ```

2. Run the container:
   ```
   docker run -p 3000:3000 -v ./uploads:/app/uploads -v ./prisma/dev.db:/app/prisma/dev.db -d mck3dprintfarm
   ```

#### Pushing to Docker Hub

If you want to push your image to Docker Hub:

1. Tag your image:
   ```
   docker tag mck3dprintfarm yourusername/mck3dprintfarm:latest
   ```

2. Push to Docker Hub:
   ```
   docker push yourusername/mck3dprintfarm:latest
   ```

3. Pull on another machine:
   ```
   docker pull yourusername/mck3dprintfarm:latest
   docker run -p 3000:3000 -v ./uploads:/app/uploads -v ./prisma/dev.db:/app/prisma/dev.db -d yourusername/mck3dprintfarm:latest
   ```

## Troubleshooting

### Common Issues with PrusaLink Printers

1. **Cannot find Python**: Ensure Python is installed and in your system PATH
2. **Missing PrusaLinkPy**: Install it using `pip install prusaLinkPy`
3. **Authentication failures**: Check that your API key is correct and the printer is accessible
4. **Upload failures**: Make sure you're uploading a `.bgcode` file, which is supported by PrusaLink printers

Use the diagnostic tools to determine the specific issue. The diagnostic page will show you detailed information about the API communication.

### Docker Issues

1. **Container exits immediately**: Check the container logs with `docker logs <container_id>`
2. **Can't access application**: Ensure port 3000 is exposed and mapped correctly
3. **Data persistence issues**: Verify volume mounts are configured properly
4. **Environment variables**: Make sure all required variables are set in your Docker Compose file or container environment

## License

MIT 