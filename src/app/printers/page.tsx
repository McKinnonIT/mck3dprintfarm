"use client";

import React, { useState, useEffect } from "react";
import { AddPrinterForm } from "@/components/add-printer-form";
import { EditPrinterForm } from "@/components/edit-printer-form";
import { PrintJobHistory } from "@/components/print-job-history";
import { DeletePrinterDialog } from "@/components/delete-printer-dialog";
import { PlusIcon, XMarkIcon, TrashIcon, ClockIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  status: string; // management status (active/disabled/maintenance)
  operationalStatus: string; // printer status (printing/idle/offline)
  lastSeen: Date;
  printStartTime?: Date;
  printTimeElapsed?: number;
  printTimeRemaining?: number;
  webcamUrl?: string;
  printImageUrl?: string;
  groupId?: string;
};

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [showJobHistory, setShowJobHistory] = useState<string | null>(null);
  const [deletingPrinter, setDeletingPrinter] = useState<Printer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPrinters = async () => {
    try {
      const response = await fetch('/api/printers');
      if (!response.ok) throw new Error('Failed to fetch printers');
      const data = await response.json();
      setPrinters(data);
    } catch (error) {
      console.error('Failed to fetch printers:', error);
    }
  };

  const fetchPrinterStatuses = async () => {
    try {
      const response = await fetch('/api/printers/status');
      if (!response.ok) throw new Error('Failed to fetch printer statuses');
      const data = await response.json();
      setPrinters(data);
    } catch (error) {
      console.error('Failed to fetch printer statuses:', error);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  useEffect(() => {
    // Update printer statuses every 5 seconds
    const interval = setInterval(fetchPrinterStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPrinter = async (newPrinter: Omit<Printer, "id">) => {
    try {
      const response = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPrinter,
          status: "active", // Set default management status to active
          operationalStatus: "idle" // Set default operational status to idle
        }),
      });

      if (!response.ok) throw new Error('Failed to add printer');
      
      const printer = await response.json();
      setPrinters(prev => [...prev, printer]);
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add printer:', error);
    }
  };

  const handleEditPrinter = async (updatedPrinter: Omit<Printer, "id">) => {
    try {
      const response = await fetch(`/api/printers/${editingPrinter?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: updatedPrinter.name,
          type: updatedPrinter.type,
          apiUrl: updatedPrinter.apiUrl,
          apiKey: updatedPrinter.apiKey,
          webcamUrl: updatedPrinter.webcamUrl,
          status: updatedPrinter.status,
          groupId: updatedPrinter.groupId,
        }),
      });

      if (!response.ok) throw new Error('Failed to update printer');
      
      const updatedPrinterData = await response.json();
      setPrinters(prev => prev.map(p => p.id === editingPrinter?.id ? updatedPrinterData : p));
      setEditingPrinter(null);
    } catch (error) {
      console.error('Failed to update printer:', error);
    }
  };

  const handleDeleteConfirmation = () => {
    if (deletingPrinter) {
      handleDeletePrinter(deletingPrinter.id);
      setDeletingPrinter(null);
    }
  };

  const handleDeletePrinter = async (printerId: string) => {
    try {
      const response = await fetch(`/api/printers/${printerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete printer');
      
      setPrinters(prev => prev.filter(p => p.id !== printerId));
      setEditingPrinter(null);
    } catch (error) {
      console.error('Failed to delete printer:', error);
    }
  };

  const filteredPrinters = printers.filter(printer =>
    printer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Printers</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Printer
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search printers by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2 pl-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredPrinters.map((printer) => (
          <div
            key={printer.id}
            className={`rounded-lg border bg-white p-6 shadow-sm ${
              printer.status === "disabled"
                ? "bg-red-50"
                : printer.status === "maintenance"
                ? "bg-gray-50"
                : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div>
                  <h3 className="text-lg font-semibold">{printer.name}</h3>
                  <p className="text-sm text-gray-500">{printer.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">API URL:</span>
                  <span className="text-sm text-gray-700">{printer.apiUrl}</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Operational Status:</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        printer.operationalStatus === "printing"
                          ? "bg-green-100 text-green-800"
                          : printer.operationalStatus === "idle"
                          ? "bg-blue-100 text-blue-800"
                          : printer.operationalStatus === "offline"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {printer.operationalStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Management Status:</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        printer.status === "active"
                          ? "bg-green-100 text-green-800"
                          : printer.status === "disabled"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {printer.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Last seen:</span>
                    <span className="text-xs text-gray-600">
                      {new Date(printer.lastSeen).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPrinter(printer)}
                  className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Edit
                </button>
                {(printer.type === "prusalink" || printer.type === "moonraker") && (
                  <Link href={`/printers/debug/${printer.id}`}>
                    <button className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 ml-2">
                      Debug
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredPrinters.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-center text-gray-500">
            {searchQuery ? "No printers found matching your search." : "No printers found."}
          </div>
        )}
      </div>

      {/* Add Printer Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowAddForm(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Add New Printer</h2>
                </div>
                <AddPrinterForm onAdd={handleAddPrinter} />
                <div className="mt-4">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Printer Modal */}
      {editingPrinter && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setEditingPrinter(null)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Edit Printer</h2>
                </div>
                <EditPrinterForm
                  printer={editingPrinter}
                  onSave={handleEditPrinter}
                  onCancel={() => setEditingPrinter(null)}
                  onDelete={() => setDeletingPrinter(editingPrinter)}
                  showJobHistory={showJobHistory === editingPrinter.id}
                  onToggleJobHistory={() => setShowJobHistory(showJobHistory === editingPrinter.id ? null : editingPrinter.id)}
                />
                {showJobHistory === editingPrinter.id && (
                  <div className="mt-4">
                    <PrintJobHistory
                      printerId={editingPrinter.id}
                      printerType={editingPrinter.type}
                      apiUrl={editingPrinter.apiUrl}
                      apiKey={editingPrinter.apiKey}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Printer Confirmation Modal */}
      {deletingPrinter && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setDeletingPrinter(null)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-red-600">Delete Printer</h2>
                </div>
                <DeletePrinterDialog
                  printerName={deletingPrinter.name}
                  onConfirm={handleDeleteConfirmation}
                  onCancel={() => setDeletingPrinter(null)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 