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
    import { CheckCircle, XCircle, AlertCircle, ArrowRight } from "lucide-react";\
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

# Create PrinterCard component
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

# Create toast component
RUN if [ ! -f "src/components/ui/toast.tsx" ]; then \
    echo '"use client";\
    \
    import * as React from "react";\
    import { cn } from "@/lib/utils";\
    import * as ToastPrimitives from "@radix-ui/react-toast";\
    import { X } from "lucide-react";\
    \
    const ToastProvider = ToastPrimitives.Provider;\
    \
    const ToastViewport = React.forwardRef<\
      React.ElementRef<typeof ToastPrimitives.Viewport>,\
      React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>\
    >(({ className, ...props }, ref) => (\
      <ToastPrimitives.Viewport\
        ref={ref}\
        className={cn(\
          "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",\
          className\
        )}\
        {...props}\
      />\
    ));\
    ToastViewport.displayName = ToastPrimitives.Viewport.displayName;\
    \
    const Toast = React.forwardRef<\
      React.ElementRef<typeof ToastPrimitives.Root>,\
      React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>\
    >(({ className, ...props }, ref) => {\
      return (\
        <ToastPrimitives.Root\
          ref={ref}\
          className={cn(\
            "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",\
            className\
          )}\
          {...props}\
        />\
      );\
    });\
    Toast.displayName = ToastPrimitives.Root.displayName;\
    \
    const ToastAction = React.forwardRef<\
      React.ElementRef<typeof ToastPrimitives.Action>,\
      React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>\
    >(({ className, ...props }, ref) => (\
      <ToastPrimitives.Action\
        ref={ref}\
        className={cn(\
          "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",\
          className\
        )}\
        {...props}\
      />\
    ));\
    ToastAction.displayName = ToastPrimitives.Action.displayName;\
    \
    const ToastClose = React.forwardRef<\
      React.ElementRef<typeof ToastPrimitives.Close>,\
      React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>\
    >(({ className, ...props }, ref) => (\
      <ToastPrimitives.Close\
        ref={ref}\
        className={cn(\
          "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",\
          className\
        )}\
        toast-close=""\
        {...props}\
      >\
        <X className="h-4 w-4" />\
      </ToastPrimitives.Close>\
    ));\
    ToastClose.displayName = ToastPrimitives.Close.displayName;\
    \
    const ToastTitle = React.forwardRef<\
      React.ElementRef<typeof ToastPrimitives.Title>,\
      React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>\
    >(({ className, ...props }, ref) => (\
      <ToastPrimitives.Title\
        ref={ref}\
        className={cn("text-sm font-semibold", className)}\
        {...props}\
      />\
    ));\
    ToastTitle.displayName = ToastPrimitives.Title.displayName;\
    \
    const ToastDescription = React.forwardRef<\
      React.ElementRef<typeof ToastPrimitives.Description>,\
      React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>\
    >(({ className, ...props }, ref) => (\
      <ToastPrimitives.Description\
        ref={ref}\
        className={cn("text-sm opacity-90", className)}\
        {...props}\
      />\
    ));\
    ToastDescription.displayName = ToastPrimitives.Description.displayName;\
    \
    type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;\
    \
    type ToastActionElement = React.ReactElement<typeof ToastAction>;\
    \
    export {\
      type ToastProps,\
      type ToastActionElement,\
      ToastProvider,\
      ToastViewport,\
      Toast,\
      ToastTitle,\
      ToastDescription,\
      ToastClose,\
      ToastAction,\
    };' > src/components/ui/toast.tsx; \
    fi

# Create use-toast hook
RUN if [ ! -f "src/components/ui/use-toast.ts" ]; then \
    echo '"use client";\
    \
    import * as React from "react";\
    \
    import type {\
      ToastActionElement,\
      ToastProps,\
    } from "@/components/ui/toast";\
    \
    const TOAST_LIMIT = 5;\
    const TOAST_REMOVE_DELAY = 1000;\
    \
    type ToasterToast = ToastProps & {\
      id: string;\
      title?: React.ReactNode;\
      description?: React.ReactNode;\
      action?: ToastActionElement;\
    };\
    \
    const actionTypes = {\
      ADD_TOAST: "ADD_TOAST",\
      UPDATE_TOAST: "UPDATE_TOAST",\
      DISMISS_TOAST: "DISMISS_TOAST",\
      REMOVE_TOAST: "REMOVE_TOAST",\
    } as const;\
    \
    let count = 0;\
    \
    function genId() {\
      count = (count + 1) % Number.MAX_VALUE;\
      return count.toString();\
    }\
    \
    type ActionType = typeof actionTypes;\
    \
    type Action =\
      | {\
          type: ActionType["ADD_TOAST"];\
          toast: ToasterToast;\
        }\
      | {\
          type: ActionType["UPDATE_TOAST"];\
          toast: Partial<ToasterToast>;\
        }\
      | {\
          type: ActionType["DISMISS_TOAST"];\
          toastId?: string;\
        }\
      | {\
          type: ActionType["REMOVE_TOAST"];\
          toastId?: string;\
        };\
    \
    interface State {\
      toasts: ToasterToast[];\
    }\
    \
    const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();\
    \
    const reducer = (state: State, action: Action): State => {\
      switch (action.type) {\
        case actionTypes.ADD_TOAST:\
          return {\
            ...state,\
            toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),\
          };\
    \
        case actionTypes.UPDATE_TOAST:\
          return {\
            ...state,\
            toasts: state.toasts.map((t) =>\
              t.id === action.toast.id ? { ...t, ...action.toast } : t\
            ),\
          };\
    \
        case actionTypes.DISMISS_TOAST: {\
          const { toastId } = action;\
    \
          // ! Side effects ! - This could be extracted into a dismissToast() action,\
          // but I\'ll keep it here for simplicity\
          if (toastId) {\
            toastTimeouts.set(\
              toastId,\
              setTimeout(() => {\
                dispatch({\
                  type: actionTypes.REMOVE_TOAST,\
                  toastId,\
                });\
              }, TOAST_REMOVE_DELAY)\
            );\
          }\
    \
          return {\
            ...state,\
            toasts: state.toasts.map((t) =>\
              t.id === toastId || toastId === undefined\
                ? {\
                    ...t,\
                    open: false,\
                  }\
                : t\
            ),\
          };\
        }\
        case actionTypes.REMOVE_TOAST:\
          if (action.toastId === undefined) {\
            return {\
              ...state,\
              toasts: [],\
            };\
          }\
          return {\
            ...state,\
            toasts: state.toasts.filter((t) => t.id !== action.toastId),\
          };\
        default:\
          return state;\
      }\
    };\
    \
    const listeners: Array<(state: State) => void> = [];\
    \
    let memoryState: State = { toasts: [] };\
    \
    function dispatch(action: Action) {\
      memoryState = reducer(memoryState, action);\
      listeners.forEach((listener) => {\
        listener(memoryState);\
      });\
    }\
    \
    type Toast = Omit<ToasterToast, "id">;\
    \
    function toast(props: Toast) {\
      const id = genId();\
    \
      const update = (props: ToasterToast) =>\
        dispatch({\
          type: actionTypes.UPDATE_TOAST,\
          toast: { ...props, id },\
        });\
      const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });\
    \
      dispatch({\
        type: actionTypes.ADD_TOAST,\
        toast: {\
          ...props,\
          id,\
          open: true,\
          onOpenChange: (open) => {\
            if (!open) dismiss();\
          },\
        },\
      });\
    \
      return {\
        id: id,\
        dismiss,\
        update,\
      };\
    }\
    \
    function useToast() {\
      const [state, setState] = React.useState<State>(memoryState);\
    \
      React.useEffect(() => {\
        listeners.push(setState);\
        return () => {\
          const index = listeners.indexOf(setState);\
          if (index > -1) {\
            listeners.splice(index, 1);\
          }\
        };\
      }, [state]);\
    \
      return {\
        ...state,\
        toast,\
        dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),\
      };\
    }\
    \
    export { useToast, toast };' > src/components/ui/use-toast.ts; \
    fi

# Create toaster component
RUN if [ ! -f "src/components/ui/toaster.tsx" ]; then \
    echo '"use client";\
    \
    import {\
      Toast,\
      ToastClose,\
      ToastDescription,\
      ToastProvider,\
      ToastTitle,\
      ToastViewport,\
    } from "@/components/ui/toast";\
    import { useToast } from "@/components/ui/use-toast";\
    \
    export function Toaster() {\
      const { toasts } = useToast();\
    \
      return (\
        <ToastProvider>\
          {toasts.map(function ({ id, title, description, action, ...props }) {\
            return (\
              <Toast key={id} {...props}>\
                <div className="grid gap-1">\
                  {title && <ToastTitle>{title}</ToastTitle>}\
                  {description && (\
                    <ToastDescription>{description}</ToastDescription>\
                  )}\
                </div>\
                {action}\
                <ToastClose />\
              </Toast>\
            );\
          })}\
          <ToastViewport />\
        </ToastProvider>\
      );\
    }' > src/components/ui/toaster.tsx; \
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