FROM node:18-alpine AS builder

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Install UI dependencies explicitly
RUN npm install --save lucide-react \
    @radix-ui/react-icons \
    @radix-ui/react-slot \
    @radix-ui/react-dropdown-menu \
    @radix-ui/react-dialog \
    @radix-ui/react-label \
    class-variance-authority \
    tailwindcss-animate

# Create the UI components directory structure
RUN mkdir -p src/components/ui

# Copy source first to let us fix missing components
COPY . .

# Create a minimal card component if it doesn't exist
RUN if [ ! -f "src/components/ui/card.tsx" ]; then \
    echo 'import * as React from "react";\
    \
    import { cn } from "@/lib/utils";\
    \
    const Card = React.forwardRef<\
      HTMLDivElement,\
      React.HTMLAttributes<HTMLDivElement>\
    >(({ className, ...props }, ref) => (\
      <div\
        ref={ref}\
        className={cn(\
          "rounded-lg border bg-card text-card-foreground shadow-sm",\
          className\
        )}\
        {...props}\
      />\
    ));\
    Card.displayName = "Card";\
    \
    const CardHeader = React.forwardRef<\
      HTMLDivElement,\
      React.HTMLAttributes<HTMLDivElement>\
    >(({ className, ...props }, ref) => (\
      <div\
        ref={ref}\
        className={cn("flex flex-col space-y-1.5 p-6", className)}\
        {...props}\
      />\
    ));\
    CardHeader.displayName = "CardHeader";\
    \
    const CardTitle = React.forwardRef<\
      HTMLParagraphElement,\
      React.HTMLAttributes<HTMLHeadingElement>\
    >(({ className, ...props }, ref) => (\
      <h3\
        ref={ref}\
        className={cn(\
          "text-2xl font-semibold leading-none tracking-tight",\
          className\
        )}\
        {...props}\
      />\
    ));\
    CardTitle.displayName = "CardTitle";\
    \
    const CardDescription = React.forwardRef<\
      HTMLParagraphElement,\
      React.HTMLAttributes<HTMLParagraphElement>\
    >(({ className, ...props }, ref) => (\
      <p\
        ref={ref}\
        className={cn("text-sm text-muted-foreground", className)}\
        {...props}\
      />\
    ));\
    CardDescription.displayName = "CardDescription";\
    \
    const CardContent = React.forwardRef<\
      HTMLDivElement,\
      React.HTMLAttributes<HTMLDivElement>\
    >(({ className, ...props }, ref) => (\
      <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />\
    ));\
    CardContent.displayName = "CardContent";\
    \
    const CardFooter = React.forwardRef<\
      HTMLDivElement,\
      React.HTMLAttributes<HTMLDivElement>\
    >(({ className, ...props }, ref) => (\
      <div\
        ref={ref}\
        className={cn("flex items-center p-6 pt-0", className)}\
        {...props}\
      />\
    ));\
    CardFooter.displayName = "CardFooter";\
    \
    export {\
      Card,\
      CardHeader,\
      CardFooter,\
      CardTitle,\
      CardDescription,\
      CardContent,\
    };' > src/components/ui/card.tsx; \
    fi

# Create a simple utils.ts file for the cn function if missing
RUN if [ ! -f "src/lib/utils.ts" ]; then \
    mkdir -p src/lib; \
    echo 'import { type ClassValue, clsx } from "clsx";\
    import { twMerge } from "tailwind-merge";\
    \
    export function cn(...inputs: ClassValue[]) {\
      return twMerge(clsx(inputs));\
    }' > src/lib/utils.ts; \
    fi

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