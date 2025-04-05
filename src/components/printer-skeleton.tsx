"use client";

import React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export function PrinterSkeleton() {
  return (
    <Card className="w-full h-full animate-pulse">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-5 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-1/4 mt-2"></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Preview area */}
          <div className="w-full h-32 bg-gray-200 rounded"></div>
          
          {/* Temperatures */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/5"></div>
              <div className="h-4 bg-gray-200 rounded w-1/5"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/5"></div>
              <div className="h-4 bg-gray-200 rounded w-1/5"></div>
            </div>
          </div>
          
          {/* Empty space for job status */}
          <div className="h-24 bg-gray-200 rounded mt-4"></div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      </CardFooter>
    </Card>
  );
} 