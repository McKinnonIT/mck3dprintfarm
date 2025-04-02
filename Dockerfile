FROM node:18-alpine AS builder

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Install UI dependencies explicitly in smaller batches
RUN npm install --no-fund --no-audit --save lucide-react @radix-ui/react-icons @radix-ui/react-slot
RUN npm install --no-fund --no-audit --save @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-toast
RUN npm install --no-fund --no-audit --save class-variance-authority tailwindcss-animate clsx tailwind-merge
RUN npm install --no-fund --no-audit --save @azure/storage-blob
RUN npm install --no-fund --no-audit --save @heroicons/react/24/outline bcryptjs next-auth

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

# Create a button component if it doesn't exist
RUN if [ ! -f "src/components/ui/button.tsx" ]; then \
    echo '"use client";\
    \
    import * as React from "react";\
    import { Slot } from "@radix-ui/react-slot";\
    import { cva, type VariantProps } from "class-variance-authority";\
    \
    import { cn } from "@/lib/utils";\
    \
    const buttonVariants = cva(\
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",\
      {\
        variants: {\
          variant: {\
            default: "bg-primary text-primary-foreground hover:bg-primary/90",\
            destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",\
            outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",\
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",\
            ghost: "hover:bg-accent hover:text-accent-foreground",\
            link: "text-primary underline-offset-4 hover:underline",\
          },\
          size: {\
            default: "h-10 px-4 py-2",\
            sm: "h-9 rounded-md px-3",\
            lg: "h-11 rounded-md px-8",\
            icon: "h-10 w-10",\
          },\
        },\
        defaultVariants: {\
          variant: "default",\
          size: "default",\
        },\
      }\
    );\
    \
    export interface ButtonProps\
      extends React.ButtonHTMLAttributes<HTMLButtonElement>,\
        VariantProps<typeof buttonVariants> {\
      asChild?: boolean;\
    }\
    \
    const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(\
      ({ className, variant, size, asChild = false, ...props }, ref) => {\
        const Comp = asChild ? Slot : "button";\
        return (\
          <Comp\
            className={cn(buttonVariants({ variant, size, className }))}\
            ref={ref}\
            {...props}\
          />\
        );\
      }\
    );\
    Button.displayName = "Button";\
    \
    export { Button, buttonVariants };' > src/components/ui/button.tsx; \
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

# Create fixed versions of components with "use client" directive
RUN mkdir -p src/components/printers

# Fix PrusaLinkSetup.tsx to add "use client" directive
RUN if [ -f "src/components/printers/PrusaLinkSetup.tsx" ]; then \
    # Get original content
    CONTENT=$(cat src/components/printers/PrusaLinkSetup.tsx); \
    # Add "use client" directive at the beginning
    echo '"use client";' > src/components/printers/PrusaLinkSetup.tsx; \
    # Add original content
    echo "$CONTENT" >> src/components/printers/PrusaLinkSetup.tsx; \
elif [ ! -f "src/components/printers/PrusaLinkSetup.tsx" ]; then \
    # Create a minimal client component to avoid build errors
    echo '"use client";\
    \
    import { useState } from "react";\
    import { Button } from "@/components/ui/button";\
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";\
    import { CheckCircle, XCircle, ArrowRight } from "lucide-react";\
    \
    export function PrusaLinkSetup() {\
      const [status, setStatus] = useState("idle");\
      \
      return (\
        <Card>\
          <CardHeader>\
            <CardTitle>PrusaLink Setup</CardTitle>\
            <CardDescription>Configure your PrusaLink connection</CardDescription>\
          </CardHeader>\
          <CardContent>\
            <p>This is a placeholder PrusaLink setup component</p>\
          </CardContent>\
          <CardFooter>\
            <Button>Setup</Button>\
          </CardFooter>\
        </Card>\
      );\
    }' > src/components/printers/PrusaLinkSetup.tsx; \
    fi

# Fix PrusaLinkDiagnostic.tsx to add "use client" directive
RUN if [ -f "src/components/printers/PrusaLinkDiagnostic.tsx" ]; then \
    # Get original content
    CONTENT=$(cat src/components/printers/PrusaLinkDiagnostic.tsx); \
    # Add "use client" directive at the beginning
    echo '"use client";' > src/components/printers/PrusaLinkDiagnostic.tsx; \
    # Add original content
    echo "$CONTENT" >> src/components/printers/PrusaLinkDiagnostic.tsx; \
elif [ ! -f "src/components/printers/PrusaLinkDiagnostic.tsx" ]; then \
    # Create a minimal client component to avoid build errors
    echo '"use client";\
    \
    import { useState } from "react";\
    import { Button } from "@/components/ui/button";\
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";\
    import { CheckCircle, XCircle, RefreshCw } from "lucide-react";\
    \
    export function PrusaLinkDiagnostic() {\
      const [status, setStatus] = useState("idle");\
      \
      return (\
        <Card>\
          <CardHeader>\
            <CardTitle>PrusaLink Diagnostic</CardTitle>\
            <CardDescription>Test your PrusaLink connection</CardDescription>\
          </CardHeader>\
          <CardContent>\
            <p>This is a placeholder PrusaLink diagnostic component</p>\
          </CardContent>\
          <CardFooter>\
            <Button>Test Connection</Button>\
          </CardFooter>\
        </Card>\
      );\
    }' > src/components/printers/PrusaLinkDiagnostic.tsx; \
    fi

# Create PrinterCard component if it doesn't exist
# NOTE: We expect this file to be created in the repo, but provide a fallback
RUN touch src/components/printers/PrinterCard.tsx.orig
RUN if [ ! -f "src/components/printers/PrinterCard.tsx" ]; then \
    echo '"use client";\
    \
    import React from "react";\
    import Link from "next/link";\
    import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";\
    import { Button } from "@/components/ui/button";\
    \
    type PrinterCardProps = {\
      id: string;\
      name: string;\
      type: string;\
      status: string;\
      operationalStatus: string;\
      lastSeen?: Date;\
      webcamUrl?: string;\
    };\
    \
    export function PrinterCard({\
      id,\
      name,\
      type,\
      status,\
      operationalStatus,\
      lastSeen,\
      webcamUrl\
    }: PrinterCardProps) {\
      return (\
        <Card className="w-full h-full">\
          <CardHeader>\
            <CardTitle className="flex justify-between items-center">\
              <span>{name}</span>\
              <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded">\
                {type}\
              </span>\
            </CardTitle>\
          </CardHeader>\
          <CardContent>\
            <div className="space-y-2">\
              <div className="flex justify-between">\
                <span className="text-gray-500">Status:</span>\
                <span className="font-medium">{status}</span>\
              </div>\
              <div className="flex justify-between">\
                <span className="text-gray-500">Operational Status:</span>\
                <span className="font-medium">{operationalStatus}</span>\
              </div>\
              {lastSeen && (\
                <div className="flex justify-between">\
                  <span className="text-gray-500">Last Seen:</span>\
                  <span className="font-medium">\
                    {new Date(lastSeen).toLocaleString()}\
                  </span>\
                </div>\
              )}\
            </div>\
          </CardContent>\
          <CardFooter className="flex justify-between">\
            <Link href={`/dashboard/printers/${id}`}>\
              <Button variant="outline">Details</Button>\
            </Link>\
            {webcamUrl && (\
              <Link href={`/dashboard/printers/${id}/webcam`}>\
                <Button variant="outline">Webcam</Button>\
              </Link>\
            )}\
          </CardFooter>\
        </Card>\
      );\
    }' > src/components/printers/PrinterCard.tsx; \
    fi

# Create Toast UI components
RUN mkdir -p src/components/ui

# Add required UI components individually using separate files
RUN mkdir -p /app/tmp-components

# Create toast files one by one
COPY ui-components/toast.tsx /app/tmp-components/
COPY ui-components/use-toast.ts /app/tmp-components/
COPY ui-components/toaster.tsx /app/tmp-components/

# Copy the UI components to the src directory if they don't exist
RUN if [ ! -f "src/components/ui/toast.tsx" ]; then \
    cp /app/tmp-components/toast.tsx src/components/ui/toast.tsx; \
    fi && \
    if [ ! -f "src/components/ui/use-toast.ts" ]; then \
    cp /app/tmp-components/use-toast.ts src/components/ui/use-toast.ts; \
    fi && \
    if [ ! -f "src/components/ui/toaster.tsx" ]; then \
    cp /app/tmp-components/toaster.tsx src/components/ui/toaster.tsx; \
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