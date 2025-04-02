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
};

export function PrinterCard({
  id,
  name,
  type,
  status,
  operationalStatus,
  lastSeen,
  webcamUrl
}: PrinterCardProps) {
  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{name}</span>
          <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {type}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Status:</span>
            <span className="font-medium">{status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Operational Status:</span>
            <span className="font-medium">{operationalStatus}</span>
          </div>
          {lastSeen && (
            <div className="flex justify-between">
              <span className="text-gray-500">Last Seen:</span>
              <span className="font-medium">
                {new Date(lastSeen).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Link href={`/dashboard/printers/${id}`}>
          <Button variant="outline">Details</Button>
        </Link>
        {webcamUrl && (
          <Link href={`/dashboard/printers/${id}/webcam`}>
            <Button variant="outline">Webcam</Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
} 