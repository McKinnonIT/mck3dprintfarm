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
  onConfirmPrint: (printerId: string) => void; // Callback with selected printer ID
  isSubmitting: boolean;
  error: string | null;
};

// Define compatible printers based on file type
const getCompatiblePrinters = (
    fileType: string | null,
    allPrinters: SelectablePrinter[]
): SelectablePrinter[] => {
    if (!fileType || !allPrinters) return [];
    const lowerFileType = fileType.toLowerCase();

    if (lowerFileType === '.bgcode') {
        // PrusaLink compatible - Should be Idle
        return allPrinters.filter(p => p.type === 'PrusaLink' && p.operationalStatus === 'idle');
    }
    // Add logic for .gcode, .gx later for Moonraker etc.
    // if (lowerFileType === '.gcode' || lowerFileType === '.gx') {
    //     return allPrinters.filter(p => p.type === 'Moonraker' && p.operationalStatus === 'idle');
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
  isSubmitting,
  error
}: PrintFileModalProps) {
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");

  const compatiblePrinters = getCompatiblePrinters(fileType, printers);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}> 
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words">Upload and Print: {fileName || ""}</DialogTitle>
          <DialogDescription>
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
          <div className="flex space-x-2 mt-2 sm:mt-0"> {/* Group action buttons */} 
            <Button
              // onClick={handleUploadOnly} // Placeholder for future action
              variant="secondary" // Different style
              disabled={!selectedPrinterId || isSubmitting}
            >
              <ArrowUpOnSquareIcon className="h-4 w-4 mr-2" /> Upload to Printer
            </Button>
            <Button
              // onClick={handleQueue} // Placeholder for future action
              variant="secondary" // Different style
              disabled={!selectedPrinterId || isSubmitting}
            >
              <QueueListIcon className="h-4 w-4 mr-2" /> Queue Print
            </Button>
            <Button
              onClick={handleConfirm} // Existing print action
              disabled={!selectedPrinterId || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white" // Add green styling
            >
              {isSubmitting ? <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : <><PrinterIcon className="h-4 w-4 mr-2" /> Print</>}
            </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 