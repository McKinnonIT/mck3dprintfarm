"use client";

import React, { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { getMediamtxHlsPageUrl } from "@/lib/camera-utils";

interface WebcamModalProps {
  printerName: string;
  webcamUrl?: string | null;
  rtspUrl?: string | null;
  onClose: () => void;
}

export function WebcamModal({ printerName, webcamUrl, rtspUrl, onClose }: WebcamModalProps) {
  const [timestamp, setTimestamp] = useState(Date.now());
  const hlsPageUrl = getMediamtxHlsPageUrl(rtspUrl);

  // Refresh the stream every 5 seconds to prevent stale content
  // (only relevant to the MJPEG/snapshot path below)
  useEffect(() => {
    if (hlsPageUrl) return;
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, [hlsPageUrl]);
  
  // Close the modal when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Create proxy URL for the stream
  const getStreamUrl = () => {
    // Make sure we're using the stream URL, not a snapshot
    let streamUrl = webcamUrl || "";
    if (streamUrl.includes('snapshot')) {
      streamUrl = streamUrl.replace('snapshot', 'stream');
    } else if (streamUrl.includes('screenshot')) {
      streamUrl = streamUrl.replace('screenshot', 'stream');
    }
    
    return `/api/webcam-proxy?url=${encodeURIComponent(streamUrl)}&t=${timestamp}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold">{printerName} - Live Camera</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-accent transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-grow overflow-hidden p-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden w-full">
            {hlsPageUrl ? (
              <iframe
                src={hlsPageUrl}
                title={`${printerName} Live Camera`}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            ) : (
              <img
                src={getStreamUrl()}
                alt={`${printerName} Webcam Stream`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
        
        <div className="p-4 border-t text-sm text-muted-foreground">
          <p>Click outside or press ESC to close</p>
        </div>
      </div>
      
      {/* Backdrop click to close */}
      <div className="absolute inset-0 z-[-1]" onClick={onClose}></div>
    </div>
  );
} 