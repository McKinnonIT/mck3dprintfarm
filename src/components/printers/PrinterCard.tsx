"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PrinterCardProps = {
  id: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
  lastSeen?: Date;
  webcamUrl?: string;
  onEdit: () => void;
};

export function PrinterCard({
  id,
  name,
  type,
  status,
  operationalStatus,
  lastSeen,
  webcamUrl,
  onEdit
}: PrinterCardProps) {
  // Determine if the printer is disabled
  const isDisabled = status === "disabled";
  
  return (
    <Card className={`w-full h-full ${isDisabled ? "bg-muted opacity-75" : ""}`}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{name}</span>
          <div className="flex gap-2">
            {isDisabled && (
              <span className="text-sm font-normal bg-accent text-accent-foreground px-2 py-1 rounded">
                Disabled
              </span>
            )}
            <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {type}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className={`font-medium ${isDisabled ? "text-muted-foreground" : ""}`}>
              {isDisabled ? "Disabled" : status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operational Status:</span>
            <span className="font-medium">
              {isDisabled ? "N/A" : operationalStatus}
            </span>
          </div>
          {lastSeen && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Seen:</span>
              <span className="font-medium">
                {new Date(lastSeen).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 border-t">
        <Link href={`/printers/${id}`}>
          <Button variant="outline" size="sm">Details</Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={onEdit} disabled={isDisabled}>
          Edit
        </Button>
        {/* TODO: Potentially add webcam link here or within details page */}
        {/* {webcamUrl && !isDisabled && ( ... )} */}
      </CardFooter>
    </Card>
  );
} 