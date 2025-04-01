"use client";

import React, { useState, useEffect } from 'react';

export default function SimpleWebcamPage() {
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  
  useEffect(() => {
    async function fetchPrinters() {
      try {
        const response = await fetch('/api/printers');
        if (response.ok) {
          const data = await response.json();
          setPrinters(data);
        }
      } catch (error) {
        console.error("Failed to fetch printers:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrinters();
  }, []);

  // Refresh snapshot images every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(Date.now());
    }, 5000);
    
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="container mx-auto p-8">Loading printers...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Simple Webcam Display</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {printers.map((printer) => (
          <div key={printer.id} className="border rounded-lg p-4">
            <h2 className="text-2xl font-bold">{printer.name}</h2>
            <p className="text-sm text-gray-600">Status: {printer.operationalStatus}</p>
            
            <div className="mt-4">
              <h3 className="font-semibold">Direct Image:</h3>
              <div className="aspect-video bg-gray-100 mt-2 rounded overflow-hidden">
                {printer.webcamUrl ? (
                  <img 
                    src={printer.webcamUrl}
                    alt="Webcam"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    No webcam URL
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="font-semibold">Proxy Image:</h3>
              <div className="aspect-video bg-gray-100 mt-2 rounded overflow-hidden">
                {printer.webcamUrl ? (
                  <img 
                    src={`/api/webcam-proxy?url=${encodeURIComponent(printer.webcamUrl)}&t=${timestamp}`}
                    alt="Webcam via proxy"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    No webcam URL
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-2">
              <p className="text-xs text-gray-500 break-all">
                Webcam URL: {printer.webcamUrl || "None"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 