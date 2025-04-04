"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PrinterCard } from "@/components/printers/PrinterCard";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Printer } from "@prisma/client";
import { useState, useEffect } from "react";

interface PrintersClientPageProps {
  initialPrinters: Printer[];
}

export default function PrintersClientPage({ initialPrinters }: PrintersClientPageProps) {
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);

  // Function to refresh printer status after stopping a print
  const refreshPrinters = async () => {
    try {
      const response = await fetch('/api/printers/status');
      if (response.ok) {
        // After refreshing the status, fetch the updated printer list
        const printersResponse = await fetch('/api/printers');
        if (printersResponse.ok) {
          const data = await printersResponse.json();
          setPrinters(data);
        }
      }
    } catch (error) {
      console.error('Error refreshing printers:', error);
    }
  };

  // Check if there are Prusa printers
  const hasPrusaPrinters = printers.some(printer => 
    printer.type.toLowerCase().includes('prusa')
  );

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Printers</h1>
          <p className="text-muted-foreground">
            View and manage your connected 3D printers
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/printers/new">Add Printer</Link>
        </Button>
      </div>

      {hasPrusaPrinters && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                PrusaLink Printers Detected
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  You have PrusaLink printers which require Python and the PrusaLinkPy library.
                  Please make sure these dependencies are installed.
                </p>
                <p className="mt-2">
                  <Link 
                    href="/dashboard/prusalink-setup" 
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Check PrusaLink Setup →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {printers.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t added any printers yet.
          </p>
          <Button asChild>
            <Link href="/dashboard/printers/new">Add Your First Printer</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {printers.map((printer) => (
            <PrinterCard 
              key={printer.id}
              id={printer.id}
              name={printer.name}
              type={printer.type}
              status={printer.status}
              operationalStatus={printer.operationalStatus}
              lastSeen={printer.lastSeen}
              webcamUrl={printer.webcamUrl}
              onStopPrint={refreshPrinters}
            />
          ))}
        </div>
      )}
    </div>
  );
} 