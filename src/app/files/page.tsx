"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, MagnifyingGlassIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { canAccessPage } from "@/lib/rbacUtils";
import { UploadFileForm } from "@/components/upload-file-form";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { GcodeThumbnailPreview } from "@/components/gcode-thumbnail-preview";
import { PrintFileModal } from "@/components/print-file-modal";
import { FilePreviewModal3D } from "@/components/file-preview-modal-3d";

// Define structure for queued job details (for the confirmation dialog)
type QueuedJobDetails = {
  jobId: string;
  fileName: string;
};

// Define File type (adjust as needed)
type File = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
};

// Define Printer type for state
type Printer = {
    id: string;
    name: string;
  type: string;
  operationalStatus: string;
};

export default function FilesPage() {
  const { data: session, status } = useSession();
  console.log("[FilesPage] Rendering FilesPage component. Status:", status);
  const router = useRouter();
  const allowedPages = session?.user?.allowedPages;
  const hasAccess = canAccessPage(allowedPages, '/files');

  const [files, setFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [allowedUploadTypes, setAllowedUploadTypes] = useState<string[]>([]);
  const [deletingFile, setDeletingFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewingFile, setPreviewingFile] = useState<File | null>(null);
  const [previewingFile3D, setPreviewingFile3D] = useState<File | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [showPrintModalForFile, setShowPrintModalForFile] = useState<File | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [showQueueConfirmDialog, setShowQueueConfirmDialog] = useState(false);
  const [queuedJobDetails, setQueuedJobDetails] = useState<QueuedJobDetails | null>(null);

  // Access control check
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    } else if (!hasAccess) {
      router.replace('/access-denied');
    }
  }, [status, hasAccess, router]);

  // Fetch settings, files, and printers
  const fetchData = useCallback(async () => {
    if (status !== 'authenticated' || !hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPrintError(null);
    try {
      // Fetch settings
      const settingsResponse = await fetch("/api/settings");
      if (!settingsResponse.ok) throw new Error('Failed to fetch settings');
      const settingsData = await settingsResponse.json();
      setAllowedUploadTypes(Array.isArray(settingsData.allowedUploadTypes) ? settingsData.allowedUploadTypes : []);

      // Fetch files
      const filesResponse = await fetch('/api/files');
      if (!filesResponse.ok) throw new Error('Failed to fetch files');
      const filesData = await filesResponse.json();
      setFiles(filesData);

      // Fetch printers
      const printersResponse = await fetch('/api/printers/status');
      if (!printersResponse.ok) throw new Error('Failed to fetch printers');
      const printersData = await printersResponse.json();
      setPrinters(printersData);

    } catch (err) {
      console.error('Failed to fetch initial data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setFiles([]);
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  }, [status, hasAccess]);

  useEffect(() => {
    if (status === 'authenticated' && hasAccess) {
      fetchData();
    }
  }, [status, hasAccess]);

  const handleUploadSuccess = (uploadedFile: File) => {
      toast.success(`File "${uploadedFile.name}" uploaded successfully!`);
      // Refetch files list (or add optimistically)
      // fetchData(); 
      setFiles(prev => [uploadedFile, ...prev]); // Optimistic update example
    setShowUploadForm(false);
  };

  // Determine the title based on session status and user name
  const pageTitle = status === 'authenticated' && session?.user?.name
    ? `${session.user.name} - Manage Files`
    : "Manage Files";

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filtered Files
  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handler for Delete Confirmation
  const handleDeleteFileConfirm = async () => {
    if (!deletingFile) return;
    
    setIsSubmitting(true);
    setDeleteError(null);
    console.log(`Attempting to delete file: ${deletingFile.id} (${deletingFile.name})`);
    
    try {
      const response = await fetch(`/api/files/${deletingFile.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Delete failed. Invalid response from server." }));
        throw new Error(errorData.error || "Failed to delete file");
      }

      toast.success(`File "${deletingFile.name}" deleted successfully!`);
      setDeletingFile(null);
      fetchData();
      
    } catch (err) {
      console.error("Delete file error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during deletion";
      setDeleteError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Print Modal Logic ---
  const openPrintModal = (file: File) => {
      setPrintError(null);
      setShowPrintModalForFile(file);
  };

  const handleConfirmPrint = async (printerId: string) => {
      if (!showPrintModalForFile) return;

      setIsSubmitting(true);
      setPrintError(null);
      const fileToPrint = showPrintModalForFile;

      console.log(`Attempting to print file ${fileToPrint.id} (${fileToPrint.name}) on printer ${printerId}`);
      toast.loading(`Sending file "${fileToPrint.name}" to printer...`);

      try {
          const response = await fetch(`/api/print-jobs`, { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                fileId: fileToPrint.id, 
                printerId: printerId, 
                printNow: true 
              }), 
          });
          const result = await response.json();
          if (!response.ok) {
              throw new Error(result.error || 'Failed to start print job.');
          }

          toast.dismiss();
          toast.success(`Print job started for "${fileToPrint.name}"!`);
          setShowPrintModalForFile(null);
      } catch (err) {
          toast.dismiss();
          console.error("Start print job error:", err);
          const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
          setPrintError(errorMessage);
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- Handler for Upload Only button ---
  const handleConfirmUpload = async (printerId: string) => {
    if (!showPrintModalForFile) return;

    setIsSubmitting(true);
    setPrintError(null);
    const fileToUpload = showPrintModalForFile;

    console.log(`Attempting to UPLOAD file ${fileToUpload.id} (${fileToUpload.name}) to printer ${printerId}`);
    toast.loading(`Uploading file "${fileToUpload.name}" to printer...`);

    try {
        const response = await fetch(`/api/print-jobs`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fileId: fileToUpload.id, 
              printerId: printerId, 
              printNow: false 
            }), 
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Failed to upload file.');
        }

        toast.dismiss();
        toast.success(`File "${fileToUpload.name}" uploaded successfully!`);
        setShowPrintModalForFile(null); // Close modal on success
    } catch (err) {
        toast.dismiss();
        console.error("Upload file error:", err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        setPrintError(errorMessage); // Show error in modal
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Handler for Queue Job button ---
  const handleConfirmQueue = async (printerId: string) => {
    if (!showPrintModalForFile) return;

    setIsSubmitting(true);
    setPrintError(null);
    const fileToQueue = showPrintModalForFile;

    console.log(`Attempting to QUEUE file ${fileToQueue.id} (${fileToQueue.name}) for printer ${printerId}`);
    // toast.loading(`Queueing job for "${fileToQueue.name}"...`); // Replaced by dialog

    try {
        const response = await fetch(`/api/jobs`, { // Call the new endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fileId: fileToQueue.id, 
              printerId: printerId, 
              // No printNow flag needed, defaults to PENDING_APPROVAL
            }), 
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Failed to queue job.');
        }

        // Show confirmation dialog instead of toast
        setQueuedJobDetails({ jobId: result.id, fileName: fileToQueue.name });
        setShowQueueConfirmDialog(true);
        setShowPrintModalForFile(null); // Close modal on success
    } catch (err) {
        // toast.dismiss(); // Removed toast
        console.error("Queue job error:", err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        setPrintError(errorMessage); // Show error in modal
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOpenPrintDialog = (file: File) => {
    console.log(`[FilesPage] Opening print dialog for file: ${file.name} (ID: ${file.id})`);
    setShowPrintModalForFile(file);
  };

  // Handle loading state for the whole page
  if (status === 'loading' || (status === 'authenticated' && !hasAccess && loading)) {
      return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      {/* Header: Title + Upload Button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <Button onClick={() => setShowUploadForm(true)} disabled={loading}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Upload File
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
          />
        </div>
      </div>

      {/* Error Display Area */}
      {error && (
         <div className="mb-4 rounded-md border border-red-400 bg-red-100 p-4 text-red-700">
           <p><strong>Error:</strong> {error}</p>
         </div>
       )}

      {/* Content Area: Loading / No Files / Files List */}
      {loading ? (
         <div className="flex justify-center items-center p-10">
           {/* Consider using a spinner component */}
           <p>Loading files...</p> 
         </div>
       ) : !error && filteredFiles.length === 0 ? (
         <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 text-center text-muted-foreground">
           {searchQuery ? "No files found matching your search." : "No files uploaded yet."}
         </div>
       ) : !error && filteredFiles.length > 0 ? (
      <div className="space-y-4">
            {filteredFiles.map((file) => {
              const lowerCaseFileName = file.name.toLowerCase();
              const fileExtension = lowerCaseFileName.substring(lowerCaseFileName.lastIndexOf('.'));
              const printableExtensions = ['.gcode', '.bgcode', '.gx'];
              const previewableGcodeExtensions = ['.gcode', '.bgcode'];
              const previewable3DExtensions = ['.stl', '.gcode'];
              const isPrintable = printableExtensions.includes(fileExtension);
              const isGcodePreviewable = previewableGcodeExtensions.includes(fileExtension);
              const is3DPreviewable = previewable3DExtensions.includes(fileExtension);

              return (
               <Card key={file.id} className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                     {/* File Info (Left) */}
                     <div className="flex-grow flex items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{file.name}</h3>
                           <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)} • {file.type}
                               {' • '} Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                  </div>
                     {/* Actions (Right) */}
                     <div className="flex flex-shrink-0 gap-2 pt-2 md:pt-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            if (is3DPreviewable) setPreviewingFile3D(file);
                          }}
                          disabled={!is3DPreviewable || isSubmitting}
                        >
                          Preview
                        </Button>
                        
                        {/* Conditional Print/Slice Button */}
                        {isPrintable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPrintDialog(file)}
                            disabled={isSubmitting}
                            className="bg-green-100 text-green-800 hover:bg-green-200"
                          >
                             <PrinterIcon className="h-4 w-4 mr-1" /> Print
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>Slice</Button>
                        )}

                        {/* Conditional Multi-Print Button */}
                        {isPrintable && (
                          <Button variant="outline" size="sm" disabled>Multi-Print</Button>
                        )}
                        
                        <Button variant="outline" size="sm" disabled>Info</Button>
                        <Button 
                           variant="destructive" 
                           size="sm" 
                           onClick={() => {
                             setDeleteError(null);
                             setDeletingFile(file);
                           }}
                           disabled={isSubmitting}
                        >
                           Delete
                        </Button>
                </div>
              </div>
               </Card>
              );
            })}
            </div>
        ) : null}
      
      {/* Upload Modal - Using Shadcn Dialog */}
      <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload New File</DialogTitle>
          </DialogHeader>
          {/* Render form inside DialogContent */} 
          <UploadFileForm
            onUploadSuccess={handleUploadSuccess}
            allowedFileTypes={allowedUploadTypes} 
            onClose={() => setShowUploadForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - Using AlertDialog */}
      <AlertDialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the file{' '}
                <code className="mx-1 font-mono bg-muted px-1 rounded">{deletingFile?.name}</code>.
            </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
                <p className="text-sm text-red-600">Error: {deleteError}</p>
            )}
            <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting} onClick={() => setDeletingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteFileConfirm} 
                disabled={isSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
                 {isSubmitting ? <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Delete File'}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gcode Thumbnail Preview Modal */}
      <GcodeThumbnailPreview
        fileId={previewingFile?.id ?? null}
        fileName={previewingFile?.name ?? null}
        isOpen={!!previewingFile}
        onClose={() => setPreviewingFile(null)}
      />

      {/* Combined 3D Preview Modal */}
      <FilePreviewModal3D
        fileId={previewingFile3D?.id ?? null}
        fileName={previewingFile3D?.name ?? null}
        isOpen={!!previewingFile3D}
        onClose={() => setPreviewingFile3D(null)}
      />

      {/* Print File Modal */}
      <PrintFileModal
          isOpen={!!showPrintModalForFile}
          onClose={() => setShowPrintModalForFile(null)}
          fileId={showPrintModalForFile?.id ?? null}
          fileName={showPrintModalForFile?.name ?? null}
          fileType={showPrintModalForFile ? showPrintModalForFile.name.substring(showPrintModalForFile.name.lastIndexOf('.')).toLowerCase() : null}
          printers={printers}
          onConfirmPrint={handleConfirmPrint}
          onConfirmUpload={handleConfirmUpload}
          onConfirmQueue={handleConfirmQueue}
          isSubmitting={isSubmitting}
          error={printError}
      />

      {/* Queue Job Confirmation Dialog */}
      <Dialog open={showQueueConfirmDialog} onOpenChange={setShowQueueConfirmDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Job Queued Successfully</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Job for file <code className="mx-1 font-mono bg-muted px-1 rounded">{queuedJobDetails?.fileName}</code> submitted.
            </p>
            <p className="mt-2">
              Check the Jobs page for further information and status updates.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowQueueConfirmDialog(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
} 