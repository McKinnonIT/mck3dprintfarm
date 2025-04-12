"use client";

import React from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileViewer3D } from "@/components/file-viewer-3d"; // Import the renamed viewer

type StlPreviewModalProps = {
  fileId: string | null;
  fileName: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export function FilePreviewModal3D({ 
  fileId,
  fileName,
  isOpen,
  onClose 
}: StlPreviewModalProps) {

  // Construct the URL for the viewer only when needed
  const fileUrl = fileId ? `/api/files/preview/${fileId}` : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}> 
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"> {/* Make modal wider */}
        <DialogHeader>
          <DialogTitle>Preview: {fileName || 'STL File'}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {fileUrl ? (
            <FileViewer3D fileId={fileId!} fileName={fileName!} />
          ) : (
            <p className="text-center text-red-600">Invalid file selected for preview.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 