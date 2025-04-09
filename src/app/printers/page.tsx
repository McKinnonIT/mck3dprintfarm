"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { canAccessPage } from "@/lib/rbacUtils";
import { AddPrinterForm } from "@/components/add-printer-form";
import { EditPrinterForm } from "@/components/edit-printer-form";
import { PlusIcon, TrashIcon, PencilIcon, PauseIcon, StopIcon, ClockIcon, PlayIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DeletePrinterDialog } from "@/components/delete-printer-dialog";
import { PrintHistoryModal } from "@/components/print-history-modal";
import { toast } from "sonner";

type NewPrinterData = {
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  serialNumber?: string;
  webcamUrl?: string;
  status: string;
  groupId?: string | null;
};

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  status: string;
  operationalStatus: string;
  lastSeen?: Date;
  printStartTime?: Date;
  printTimeElapsed?: number;
  printTimeRemaining?: number;
  webcamUrl?: string;
  printImageUrl?: string;
  groupId?: string;
};

type JobHistoryEntry = {
  timestamp: number | string;
  filename: string;
  duration?: number;
  status: 'completed' | 'failed' | 'cancelled' | 'unknown';
};

export default function PrintersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const allowedPages = session?.user?.allowedPages;
  const hasAccess = canAccessPage(allowedPages, '/printers');

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPrinter, setDeletingPrinter] = useState<Printer | null>(null);
  const [showHistoryModalFor, setShowHistoryModalFor] = useState<Printer | null>(null);
  const [historyData, setHistoryData] = useState<JobHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      console.log("PrintersPage: Unauthenticated, redirecting...");
      router.replace('/auth/signin');
    } else if (!hasAccess) {
      console.log("PrintersPage: Access denied, redirecting to /access-denied...");
      router.replace('/access-denied');
    }
  }, [status, hasAccess, router]);

  const fetchPrinters = useCallback(async () => {
    if (status !== 'authenticated' || !hasAccess) {
      setLoading(false);
      return;
    }
    console.log("PrintersPage: Fetching printers (access granted).");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/printers/status');
      if (!response.ok) throw new Error('Failed to fetch printer status');
      const data = await response.json();
      setPrinters(data);
    } catch (err) {
      console.error('Failed to fetch printers:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [status, hasAccess]);

  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  const openModal = (printer: Printer | null = null) => {
    console.log("Opening modal for:", printer);
    setEditingPrinter(printer);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingPrinter(null);
  };

  const handleAddPrinterSubmit = async (printerData: NewPrinterData) => {
    setIsSubmitting(true);
    setError(null);
    console.log("Submitting new printer:", printerData);

    try {
      const response = await fetch('/api/printers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printerData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to add printer. Invalid response from server." }));
        throw new Error(errorData.message || "Failed to add printer");
      }

      const newPrinter = await response.json();
      toast.success(`Printer "${newPrinter.name}" added successfully!`);
      fetchPrinters();
      closeModal();
    } catch (err) {
      console.error("Add printer error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast.error(`Error adding printer: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPrinterSubmit = async (printerData: Omit<Printer, 'id' | 'operationalStatus' | 'lastSeen'>) => {
    if (!editingPrinter) return;
    setIsSubmitting(true);
    setError(null);
    console.log(`Submitting update for printer ${editingPrinter.id}:`, printerData);

    try {
      const response = await fetch(`/api/printers/${editingPrinter.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printerData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update printer. Invalid response from server." }));
        throw new Error(errorData.message || "Failed to update printer");
      }

      const updatedPrinter = await response.json();
      toast.success(`Printer "${updatedPrinter.name}" updated successfully!`);
      fetchPrinters();
      closeModal();
    } catch (err) {
      console.error("Update printer error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast.error(`Error updating printer: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrinter = async () => {
    if (!deletingPrinter) return;
    setIsSubmitting(true);
    setError(null);
    console.log(`Attempting to delete printer: ${deletingPrinter.id}`);
    try {
      const response = await fetch(`/api/printers/${deletingPrinter.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Delete failed" }));
        throw new Error(errorData.message || "Failed to delete printer");
      }

      toast.success(`Printer "${deletingPrinter.name}" deleted successfully!`);
      setDeletingPrinter(null);
      fetchPrinters();
    } catch (err) {
      console.error("Delete printer error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast.error(`Error deleting printer: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrinterAction = async (printerId: string, action: 'pause' | 'cancel' | 'resume') => {
    setIsSubmitting(true);
    setError(null);
    let actionText = 'Performing action';
    let actionTextPast = 'performed';
    switch (action) {
      case 'pause': actionText = 'Pausing'; actionTextPast = 'paused'; break;
      case 'resume': actionText = 'Resuming'; actionTextPast = 'resumed'; break;
      case 'cancel': actionText = 'Cancelling'; actionTextPast = 'cancelled'; break;
    }
    console.log(`${actionText} action for printer ${printerId}`);
    toast.loading(`${actionText} printer...`);

    try {
      const response = await fetch(`/api/printers/${printerId}/control/${action}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to ${action} print`);
      }

      // Optimistic UI Update for Pause/Resume
      if (action === 'pause' || action === 'resume') {
        setPrinters(currentPrinters =>
          currentPrinters.map(p => {
            if (p.id === printerId) {
              const newStatus = action === 'pause' ? 'paused' : 'printing';
              console.log(`Optimistically updating printer ${printerId} status to ${newStatus}`);
              return { ...p, operationalStatus: newStatus };
            }
            return p;
          })
        );
      }

      toast.dismiss();
      toast.success(result.message || `Print successfully ${actionTextPast}.`);
      fetchPrinters();

    } catch (err) {
      toast.dismiss();
      const errorMessage = err instanceof Error ? err.message : `Unknown error during ${action}`;
      console.error(`${actionText} error:`, err);
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowHistory = async (printer: Printer) => {
    setShowHistoryModalFor(printer);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryData(null);

    try {
      const response = await fetch(`/api/printers/${printer.id}/history`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to load history" }));
        throw new Error(errorData.message || "Failed to load history");
      }
      const data: JobHistoryEntry[] = await response.json();
      setHistoryData(data);
    } catch (err) {
      console.error(`Error fetching history for ${printer.name}:`, err);
      setHistoryError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredPrinters = printers.filter(printer =>
    printer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (status === 'loading' || (status === 'authenticated' && !hasAccess && !loading)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const renderStatusBadge = (label: string, value: string) => {
    let bgColor = "bg-gray-100";
    let textColor = "text-gray-800";
    switch (value?.toLowerCase()) {
      case "active":
      case "idle":
      case "printing":
        bgColor = "bg-green-100"; textColor = "text-green-800"; break;
      case "disabled":
      case "offline":
        bgColor = "bg-red-100"; textColor = "text-red-800"; break;
      case "maintenance":
        bgColor = "bg-yellow-100"; textColor = "text-yellow-800"; break;
    }
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">{label}:</span>
        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${bgColor} ${textColor}`}>
          {value || 'N/A'}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Printers</h1>
        <Button onClick={() => openModal()} disabled={isSubmitting}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Printer
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search printers by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {error && !isModalOpen && !deletingPrinter && <p className="text-red-600 mb-4">Error: {error}</p>}

      {loading ? (
        <div className="py-10 text-center text-gray-500">Loading printers...</div>
      ) : !error && filteredPrinters.length === 0 ? (
        <div className="text-center py-10 border rounded-lg bg-gray-50">
          <p className="text-muted-foreground mb-4">
            No printers found{searchQuery ? ` matching "${searchQuery}"` : ""}.
          </p>
          {!searchQuery && (
            <Button onClick={() => openModal()} disabled={isSubmitting}>Add Your First Printer</Button>
          )}
        </div>
      ) : !error && filteredPrinters.length > 0 ? (
        <div className="space-y-4">
          {filteredPrinters.map((printer) => (
            <div
              key={printer.id}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-grow items-center gap-4">
                <div className="space-y-1 flex-shrink-0">
                  <h3 className="text-lg font-semibold">{printer.name}</h3>
                  <p className="text-sm text-gray-600 truncate" title={printer.apiUrl}>API: {printer.apiUrl}</p>
                  <p className="text-sm text-gray-600">Type: {printer.type}</p>
                </div>
                <div className="flex flex-col items-start gap-1 flex-shrink-0 pl-4 border-l ml-4">
                  {renderStatusBadge("Management Status", printer.status)}
                  {renderStatusBadge("Operational Status", printer.operationalStatus)}
                </div>
                <div className="flex-grow"></div>
              </div>
              
              <div className="flex flex-shrink-0 gap-2 pt-2 md:pt-0">
                {printer.operationalStatus === 'paused' ? (
                  <Button
                    className="bg-green-100 text-green-800 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400"
                    size="sm"
                    onClick={() => handlePrinterAction(printer.id, 'resume')}
                    disabled={isSubmitting || printer.status !== 'active'}
                    aria-label={`Resume ${printer.name}`}
                    title="Resume Print"
                  >
                    <PlayIcon className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:bg-gray-100 disabled:text-gray-400"
                    size="sm"
                    onClick={() => handlePrinterAction(printer.id, 'pause')}
                    disabled={isSubmitting || printer.status !== 'active' || printer.operationalStatus !== 'printing'}
                    aria-label={`Pause ${printer.name}`}
                    title="Pause Print"
                  >
                    <PauseIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handlePrinterAction(printer.id, 'cancel')}
                  disabled={isSubmitting || printer.status !== 'active' || printer.operationalStatus !== 'printing'}
                  aria-label={`Stop ${printer.name}`}
                  title="Cancel Print"
                >
                  <StopIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShowHistory(printer)}
                  disabled={isSubmitting || historyLoading && showHistoryModalFor?.id === printer.id}
                  aria-label={`History for ${printer.name}`}
                  title="Print History"
                >
                  <ClockIcon className="h-4 w-4" />
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => openModal(printer)} 
                  disabled={isSubmitting}
                  aria-label={`Edit ${printer.name}`}
                  title="Edit Printer"
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open && !isSubmitting) closeModal(); }}>
         <DialogContent className="sm:max-w-[600px]">
           <DialogHeader>
             <DialogTitle>{editingPrinter ? "Edit Printer" : "Add New Printer"}</DialogTitle>
             {error && isModalOpen && <p className="text-sm text-red-600 pt-2">Error: {error}</p>}
           </DialogHeader>
           {editingPrinter ? (
             <EditPrinterForm 
               printer={editingPrinter} 
               onSave={handleEditPrinterSubmit}
               onCancel={closeModal}
               onDelete={() => {
                 closeModal();
                 setDeletingPrinter(editingPrinter);
               }}
               isSubmitting={isSubmitting}
             />
           ) : (
             <AddPrinterForm 
               onAdd={handleAddPrinterSubmit}
               onCancel={closeModal}
               isSubmitting={isSubmitting}
             />
           )}
         </DialogContent>
       </Dialog>

      {deletingPrinter && (
          <DeletePrinterDialog
              printerName={deletingPrinter.name}
              onCancel={() => setDeletingPrinter(null)}
              onConfirm={handleDeletePrinter}
              isSubmitting={isSubmitting}
          />
      )}

      {showHistoryModalFor && (
        <PrintHistoryModal
          printerName={showHistoryModalFor.name}
          history={historyData}
          isLoading={historyLoading}
          error={historyError}
          isOpen={!!showHistoryModalFor}
          onClose={() => {
            setShowHistoryModalFor(null);
            setHistoryData(null);
            setHistoryError(null);
          }}
        />
      )}
    </div>
  );
}