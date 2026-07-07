"use client";

import React from "react";
import { Spinner } from "@/components/ui/spinner";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex flex-col items-center justify-center">
      <div className="bg-card rounded-lg shadow-lg p-8 max-w-md w-full mx-auto flex flex-col items-center">
        <Spinner size="lg" className="text-blue-600 mb-6" />
        <h2 className="text-2xl font-medium text-foreground mb-3">{message}</h2>
        <p className="text-sm text-muted-foreground text-center">
          Please wait while we collect all printer data. This may take a moment.
        </p>
      </div>
    </div>
  );
} 