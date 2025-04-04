"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "@prisma/client";

interface StopPrintButtonProps {
  printer: Printer;
  onStopPrint?: () => void;
}

export function StopPrintButton({ printer, onStopPrint }: StopPrintButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleStopPrint = async () => {
    if (!confirm(`Are you sure you want to stop printing on ${printer.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/printers/stop-print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerId: printer.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Print job has been stopped successfully");
        
        // Call the callback function if provided
        if (onStopPrint) {
          onStopPrint();
        }
      } else {
        alert(`Error: ${data.message || "Failed to stop print job"}`);
      }
    } catch (error) {
      console.error("Error stopping print job:", error);
      alert("An unexpected error occurred while trying to stop the print job");
    } finally {
      setLoading(false);
    }
  };

  // Only show the button if the printer is in the printing state
  if (printer.operationalStatus !== "printing") {
    return null;
  }

  return (
    <Button
      onClick={handleStopPrint}
      disabled={loading}
      title="Stop current print job"
      className="w-full bg-red-600 hover:bg-red-700 text-white"
    >
      {loading ? "Stopping..." : "Stop Printing"}
    </Button>
  );
} 