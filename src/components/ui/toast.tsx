"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";

// Export types
export type ToastActionElement = React.ReactElement;

export type ToastProps = {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Export all the components needed
export const ToastProvider = ToastPrimitives.Provider;
export const ToastViewport = ToastPrimitives.Viewport;
export const ToastTitle = ToastPrimitives.Title;
export const ToastDescription = ToastPrimitives.Description;
export const ToastClose = ToastPrimitives.Close;

// A basic toast component
export function Toast({
  className = "",
  title,
  description,
  action,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <ToastPrimitives.Root
      {...props}
      className={`bg-white dark:bg-gray-800 rounded-md shadow-lg p-4 ${className}`}
    >
      {children || (
        <>
          <div className="grid gap-1">
            {title && <ToastPrimitives.Title className="font-medium">{title}</ToastPrimitives.Title>}
            {description && (
              <ToastPrimitives.Description className="text-sm opacity-80">
                {description}
              </ToastPrimitives.Description>
            )}
          </div>
          {action && <div className="flex justify-end">{action}</div>}
        </>
      )}
    </ToastPrimitives.Root>
  );
} 