"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner"; // Assuming you have a Spinner component

type GcodeThumbnailPreviewProps = {
  fileId: string | null;
  fileName: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export function GcodeThumbnailPreview({ fileId, fileName, isOpen, onClose }: GcodeThumbnailPreviewProps) {
  const [thumbnailDataUri, setThumbnailDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fileId) {
      // Reset state when opening for a new file
      setThumbnailDataUri(null);
      setError(null);
      setIsLoading(true);

      const fetchThumbnail = async () => {
        try {
          const response = await fetch(`/api/files/${fileId}/thumbnail`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to load thumbnail (${response.status})`);
          }
          const data = await response.json();
          if (data.dataUri) {
            setThumbnailDataUri(data.dataUri);
          } else {
            throw new Error("No thumbnail data received");
          }
        } catch (err) {
          console.error("Error fetching thumbnail:", err);
          setError(err instanceof Error ? err.message : "Could not load thumbnail");
        } finally {
          setIsLoading(false);
        }
      };

      fetchThumbnail();
    } else {
      // Reset when closed or no fileId
      setThumbnailDataUri(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, fileId]); // Depend on isOpen and fileId

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Thumbnail Preview: {fileName || ""}</DialogTitle>
        </DialogHeader>
        <div className="py-4 min-h-[200px] flex items-center justify-center">
          {isLoading && <Spinner size="lg" />} 
          {error && <p className="text-red-600 text-center">Error: {error}</p>}
          {thumbnailDataUri && !isLoading && !error && (
            <img 
              src={thumbnailDataUri} 
              alt={`Thumbnail for ${fileName}`}
              className="max-w-full max-h-[400px] object-contain mx-auto"
            />
          )}
          {!isLoading && !error && !thumbnailDataUri && (
             <p className="text-muted-foreground text-center">No preview available.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 