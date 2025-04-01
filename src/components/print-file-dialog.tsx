"use client";

import React, { useState, useEffect } from "react";
import { PrinterIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";

type Printer = {
  id: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
};

type PrintFileDialogProps = {
  fileName: string;
  fileId: string;
  onClose: () => void;
};

export function PrintFileDialog({ fileName, fileId, onClose }: PrintFileDialogProps) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const fileIsGcode = fileName.toLowerCase().endsWith('.gcode');
  const fileIsBGcode = fileName.toLowerCase().endsWith('.bgcode');

  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const response = await fetch('/api/printers');
        if (!response.ok) throw new Error('Failed to fetch printers');
        const data = await response.json();
        
        // Filter to only include active printers
        // For PrusaLink printers, include them regardless of operational status
        // For other printers, only include idle or offline ones
        const availablePrinters = data.filter(
          (printer: Printer) => 
            printer.status === 'active' && 
            (printer.type.toLowerCase().includes('prusa') || 
             printer.type.toLowerCase() === 'moonraker' ||
             printer.operationalStatus === 'idle' || 
             printer.operationalStatus === 'offline')
        );
        
        setPrinters(availablePrinters);
        if (availablePrinters.length > 0) {
          setSelectedPrinterId(availablePrinters[0].id);
          setSelectedPrinter(availablePrinters[0]);
        }
      } catch (error) {
        console.error('Failed to fetch printers:', error);
        setError('Failed to load available printers. Please try again.');
      }
    };

    fetchPrinters();
  }, []);

  // Update selected printer when printer ID changes
  useEffect(() => {
    const printer = printers.find(p => p.id === selectedPrinterId);
    setSelectedPrinter(printer || null);
  }, [selectedPrinterId, printers]);

  const handlePrinterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPrinterId(e.target.value);
  };

  // Check if there's a printer type mismatch with the file type
  const isPrusaPrinter = selectedPrinter?.type.toLowerCase().includes('prusa');
  const isMoonrakerPrinter = selectedPrinter?.type.toLowerCase() === 'moonraker';
  
  // For Prusa printers, gcode files are not compatible
  // For Moonraker printers, only gcode files are compatible, not bgcode
  const hasFilePrinterMismatch = (isPrusaPrinter && fileIsGcode) || 
                               (isMoonrakerPrinter && fileIsBGcode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPrinterId) {
      setError('Please select a printer');
      return;
    }

    // For PrusaLink printers, enforce bgcode files
    if (isPrusaPrinter && fileIsGcode) {
      setError('Only Prusa printers support .bgcode files. Regular .gcode files cannot be processed by PrusaLink firmware.');
      return;
    }

    // For Moonraker printers, enforce gcode files
    if (isMoonrakerPrinter && fileIsBGcode) {
      setError('Moonraker printers only support .gcode files. Please use a .gcode file instead.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          printerId: selectedPrinterId,
          printNow: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send print job');
      }

      setSuccess(true);
      setSuccessMessage("Your file has been queued for printing.");
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to send print job:', error);
      setError(error instanceof Error ? error.message : 'Failed to send print job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadToPrinter = async () => {
    if (!selectedPrinterId) {
      setError('Please select a printer');
      return;
    }

    // For PrusaLink printers, enforce bgcode files
    if (isPrusaPrinter && fileIsGcode) {
      setError('Only Prusa printers support .bgcode files. Regular .gcode files cannot be processed by PrusaLink firmware.');
      return;
    }

    // For Moonraker printers, enforce gcode files
    if (isMoonrakerPrinter && fileIsBGcode) {
      setError('Moonraker printers only support .gcode files. Please use a .gcode file instead.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          printerId: selectedPrinterId,
          printNow: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file to printer');
      }

      setSuccess(true);
      setSuccessMessage("Your file has been uploaded to the printer's storage.");
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to upload file to printer:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload file to printer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold">Print Options</h2>
        <p className="text-sm text-gray-500 mt-1">{fileName}</p>
      </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="mt-2 text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="mt-2 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="printer" className="block text-sm font-medium text-gray-700">
              Select Printer
            </label>
            <select
              id="printer"
              value={selectedPrinterId}
              onChange={handlePrinterChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              {printers.length === 0 ? (
                <option value="" disabled>No available printers</option>
              ) : (
                printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name} ({printer.type})
                  </option>
                ))
              )}
            </select>
            {printers.length === 0 && (
              <p className="mt-2 text-sm text-red-600">
                No available printers found. Make sure printers are active and idle.
              </p>
            )}
            
            {/* Warning about file-printer compatibility */}
            {hasFilePrinterMismatch && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                  <strong>Note: Only Prusa printers support .bgcode files.</strong>
                </p>
              </div>
            )}

            {isMoonrakerPrinter && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Moonraker printers only support .gcode files.</strong>
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-200">
            <div className="space-x-2">
              <button
                type="submit"
                disabled={loading || printers.length === 0 || hasFilePrinterMismatch}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <PrinterIcon className="h-4 w-4 mr-1" />
                {loading ? 'Sending...' : 'Upload and Print'}
              </button>
              <button
                type="button"
                onClick={handleUploadToPrinter}
                disabled={loading || printers.length === 0 || hasFilePrinterMismatch}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Upload to Printer
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 