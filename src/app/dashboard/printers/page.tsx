"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PrinterCard } from "@/components/printers/PrinterCard";
import { InfoIcon } from "./infoicon";
import { LoadingScreen } from "@/components/loading-screen";
import { PrinterSkeleton } from "@/components/printer-skeleton";
import { useSession } from "next-auth/react";

export default function PrintersPage() {
  const { data: session, status } = useSession();
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch printers if the user is authenticated
    if (status === "authenticated") {
      const fetchPrinters = async () => {
        try {
          setLoading(true);
          const startTime = Date.now();
          
          // First get the basic printer list
          const printerResponse = await fetch("/api/printers");
          if (!printerResponse.ok) {
            throw new Error("Failed to fetch printers");
          }
          
          const printerData = await printerResponse.json();
          
          // Then get the current status for all printers
          const statusResponse = await fetch("/api/printers/status");
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            // For management view, show all printers including disabled/offline
            // but with clear visual indicators of their status
            setPrinters(statusData);
          } else {
            // Fall back to basic data if status fetch fails
            setPrinters(printerData);
          }
          
          // Ensure loading state shows for at least 1 second
          const elapsed = Date.now() - startTime;
          if (elapsed < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
          }
        } catch (error) {
          console.error("Error fetching printers:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchPrinters();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  if (status === "loading") {
    return <LoadingScreen message="Loading printers" />;
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Please sign in to view this page.</p>
      </div>
    );
  }

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
              <InfoIcon />
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

      {loading ? (
        // Show skeleton cards while loading
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, index) => (
            <PrinterSkeleton key={index} />
          ))}
        </div>
      ) : printers.length === 0 ? (
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
            />
          ))}
        </div>
      )}
    </div>
  );
} 