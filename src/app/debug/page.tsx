"use client";

import React, { useState, useEffect } from 'react';

export default function DebugPage() {
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  
  useEffect(() => {
    async function fetchPrinters() {
      try {
        const response = await fetch('/api/printers');
        if (response.ok) {
          const data = await response.json();
          setPrinters(data);
          
          // Fetch debug info for each Moonraker printer
          const debugData: Record<string, any> = {};
          for (const printer of data) {
            if (printer.type === 'moonraker') {
              try {
                const debugResponse = await fetch(`/api/debug-webcam?printer_url=${encodeURIComponent(printer.apiUrl)}`);
                if (debugResponse.ok) {
                  debugData[printer.id] = await debugResponse.json();
                }
              } catch (error) {
                console.error(`Error fetching debug info for ${printer.name}:`, error);
                debugData[printer.id] = { error: 'Failed to fetch debug info' };
              }
            }
          }
          setDebugInfo(debugData);
        }
      } catch (error) {
        console.error("Failed to fetch printers:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrinters();
  }, []);

  if (loading) {
    return <div className="container mx-auto p-8">Loading printer information...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Printer Debug Information</h1>
      
      {printers.map((printer) => (
        <div key={printer.id} className="mb-12 border p-6 rounded-lg">
          <h2 className="text-2xl font-bold">{printer.name}</h2>
          <div className="text-sm text-gray-600 mb-4">
            <p>Printer type: {printer.type}</p>
            <p>API URL: {printer.apiUrl}</p>
            <p>Webcam URL (stored): {printer.webcamUrl || "None"}</p>
            <p>Status: {printer.operationalStatus}</p>
            <p>Last seen: {new Date(printer.lastSeen).toLocaleString()}</p>
          </div>
          
          {printer.type === 'moonraker' && (
            <>
              <h3 className="text-xl font-semibold mb-2">Moonraker API Debug Info</h3>
              {debugInfo[printer.id] ? (
                <div className="space-y-4">
                  <div className="bg-gray-100 p-4 rounded">
                    <h4 className="font-bold">Webcam Info from Moonraker:</h4>
                    {debugInfo[printer.id].webcamInfo ? (
                      <div>
                        <p>Has webcams: {debugInfo[printer.id].webcamInfo.hasWebcams ? 'Yes' : 'No'}</p>
                        <p>Webcam count: {debugInfo[printer.id].webcamInfo.webcamCount}</p>
                        {debugInfo[printer.id].webcamInfo.defaultWebcam && (
                          <div className="ml-4 mt-2">
                            <p>Default webcam name: {debugInfo[printer.id].webcamInfo.defaultWebcam.name}</p>
                            <p>Stream URL: {debugInfo[printer.id].webcamInfo.streamUrl}</p>
                            <p>Snapshot URL: {debugInfo[printer.id].webcamInfo.snapshotUrl}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>No webcam info available</p>
                    )}
                  </div>
                  
                  <div className="bg-gray-100 p-4 rounded">
                    <h4 className="font-bold">Stream URL Check:</h4>
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(debugInfo[printer.id].streamCheckResult, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="bg-gray-100 p-4 rounded">
                    <h4 className="font-bold">Snapshot URL Check:</h4>
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(debugInfo[printer.id].snapshotCheckResult, null, 2)}
                    </pre>
                  </div>
                  
                  {debugInfo[printer.id].webcamInfo?.streamUrl && (
                    <div>
                      <h4 className="font-bold mb-2">Stream Test (iframe):</h4>
                      <div className="aspect-video bg-gray-200 rounded overflow-hidden">
                        <iframe 
                          src={debugInfo[printer.id].webcamInfo.streamUrl}
                          className="w-full h-full border-0"
                          title="Stream test"
                        ></iframe>
                      </div>
                    </div>
                  )}
                  
                  {debugInfo[printer.id].webcamInfo?.streamUrl && (
                    <div>
                      <h4 className="font-bold mb-2">Stream Test (img):</h4>
                      <div className="aspect-video bg-gray-200 rounded overflow-hidden">
                        <img 
                          src={debugInfo[printer.id].webcamInfo.streamUrl}
                          alt="Stream test"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  
                  {debugInfo[printer.id].webcamInfo?.snapshotUrl && (
                    <div>
                      <h4 className="font-bold mb-2">Snapshot Test:</h4>
                      <div className="aspect-video bg-gray-200 rounded overflow-hidden">
                        <img 
                          src={`${debugInfo[printer.id].webcamInfo.snapshotUrl}?t=${Date.now()}`}
                          alt="Snapshot test"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p>Loading debug info...</p>
              )}
            </>
          )}
          
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Current Webcam Display</h3>
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              {printer.webcamUrl ? (
                <img
                  src={printer.webcamUrl}
                  alt="Printer Webcam"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No webcam URL configured
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 