"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"; // Using Select for printer choice
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowPathIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { ArrowUpOnSquareIcon, QueueListIcon } from "@heroicons/react/24/outline"; // Import new icons
import { usePermissions } from "@/hooks/usePermissions"; // Import the hook

// Simplified Printer type for selection
type SelectablePrinter = {
  id: string;
  name: string;
  type: string; // e.g., 'PrusaLink', 'Moonraker'
  operationalStatus: string; // e.g., 'idle', 'printing'
};

type PrintFileModalProps = {
  fileId: string | null;
  fileName: string | null;
  fileType: string | null; // e.g., '.bgcode', '.gcode'
  printers: SelectablePrinter[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: (printerId: string) => void; // Callback for Print button
  onConfirmUpload: (printerId: string) => void; // Callback for Upload button
  isSubmitting: boolean;
  error: string | null;
};

// Define compatible printers based on file type
const getCompatiblePrinters = (
    // Note: We now primarily use fileName for extension check for PrusaLink
    fileName: string | null, 
    fileType: string | null, // Keep for potential use with other types
    allPrinters: SelectablePrinter[]
): SelectablePrinter[] => {
    if (!allPrinters) return [];

    // PrusaLink Check (using filename extension and case-insensitive type)
    const isPrusaFileType = fileName?.toLowerCase().endsWith('.bgcode') || fileName?.toLowerCase().endsWith('.gcode');
    if (isPrusaFileType) {
        return allPrinters.filter(
            p => p.type?.toLowerCase() === 'prusalink' && p.operationalStatus === 'idle'
        );
    }
    
    // Placeholder for Moonraker (example using fileType MIME type)
    // if (fileType === 'application/x-gcode' && ...) { 
    //    return allPrinters.filter(p => p.type?.toLowerCase() === 'moonraker' && ...);
    // }

    return []; // No compatible printers for other types yet
};


export function PrintFileModal({
  fileId,
  fileName,
  fileType,
  printers = [],
  isOpen,
  onClose,
  onConfirmPrint,
  onConfirmUpload,
  isSubmitting,
  error
}: PrintFileModalProps) {
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");
  const { can } = usePermissions(); // Use the hook

  // Find the selected printer object to check its type
  const selectedPrinter = printers.find(p => p.id === selectedPrinterId);
  const isPrusaSelected = !!selectedPrinter && selectedPrinter.type.toLowerCase().includes('prusa');

  // Pass fileName and fileType to the filter function
  const compatiblePrinters = getCompatiblePrinters(fileName, fileType, printers);

  // Reset selection when modal opens or compatible printers change
  useEffect(() => {
    if (isOpen) {
      setSelectedPrinterId(""); // Clear selection when opening
      if (compatiblePrinters.length === 1) {
        // Auto-select if only one compatible printer
        setSelectedPrinterId(compatiblePrinters[0].id);
      }
    }
  }, [isOpen, compatiblePrinters]); // Rerun when compatiblePrinters list potentially changes


  const handleConfirm = () => {
    if (selectedPrinterId) {
      onConfirmPrint(selectedPrinterId);
    }
  };

  // Handler for Upload button
  const handleUpload = () => {
    if (selectedPrinterId) {
      onConfirmUpload(selectedPrinterId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}> 
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send File to Printer</DialogTitle>
          {fileName && <p className="text-sm text-muted-foreground pt-1 truncate">File: {fileName}</p>}
          <DialogDescription className="pt-2">
            Select a compatible printer to send this file to.
            Only online and idle printers are shown.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="printer-select" className="">
              Printer
            </Label>
            <Select
              value={selectedPrinterId}
              onValueChange={setSelectedPrinterId}
              disabled={compatiblePrinters.length === 0 || isSubmitting}
            >
              <SelectTrigger id="printer-select" className="">
                <SelectValue placeholder={compatiblePrinters.length === 0 ? "No compatible printers available" : "Select a printer..."} />
              </SelectTrigger>
              <SelectContent>
                {compatiblePrinters.map((printer) => (
                  <SelectItem key={printer.id} value={printer.id}>
                    {printer.name} ({printer.operationalStatus})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
                <p className="text-sm text-red-600 col-span-4 text-center">Error: {error}</p>
            )}
        </div>
        <DialogFooter className="sm:justify-between"> {/* Adjust footer layout */}
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="mt-2 sm:mt-0">Cancel</Button>
          {/* Use specific permission checks for each button */} 
          <div className="flex space-x-2 mt-2 sm:mt-0"> {/* Group action buttons */} 
            {can('files:uploadToPrinter') && (
              <Button
                onClick={handleUpload}
                variant="secondary"
                // Disable if no printer selected, submitting, OR if a Prusa printer is selected
                disabled={!selectedPrinterId || isSubmitting || isPrusaSelected}
                title={isPrusaSelected ? "Upload only is not applicable for PrusaLink (upload implies print start)" : undefined}
              >
                <ArrowUpOnSquareIcon className="h-4 w-4 mr-2" /> Upload to Printer
              </Button>
            )}
            {can('files:queuePrint') && (
              <Button
                variant="secondary"
                disabled={!selectedPrinterId || isSubmitting}
                // TODO: Add onClick handler for queueing
              >
                <QueueListIcon className="h-4 w-4 mr-2" /> Queue Print 
              </Button>
            )}
            {can('files:startPrint') && (
              <Button
                onClick={handleConfirm} // This implicitly handles upload+print for Prusa
                disabled={!selectedPrinterId || isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : <>Print</>}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 