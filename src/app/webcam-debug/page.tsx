"use client";

import React, { useState, useEffect } from "react";

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  webcamUrl?: string;
  operationalStatus: string;
};

export default function WebcamDebugPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [customWebcamUrl, setCustomWebcamUrl] = useState("");
  const [timestamp, setTimestamp] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState("");
  const [useStream, setUseStream] = useState(true);
  const [useProxy, setUseProxy] = useState(true);
  const [displayedWebcamUrl, setDisplayedWebcamUrl] = useState("");

  useEffect(() => {
    fetchPrinters();
  }, []);

  // Refresh webcam images every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPrinters = async () => {
    try {
      const response = await fetch("/api/printers");
      if (!response.ok) throw new Error("Failed to fetch printers");
      const data = await response.json();
      setPrinters(data);
      if (data.length > 0) {
        setSelectedPrinter(data[0]);
      }
    } catch (error) {
      setErrorMessage("Failed to fetch printers");
      console.error("Error fetching printers:", error);
    }
  };

  const getCurrentWebcamUrl = () => {
    if (customWebcamUrl) {
      return customWebcamUrl;
    }
    return selectedPrinter?.webcamUrl || "";
  };

  const getDisplayUrl = () => {
    const baseUrl = getCurrentWebcamUrl();
    if (!baseUrl) return "";
    
    // Convert between stream and snapshot if needed
    let url = baseUrl;
    if (!useStream && url.includes('stream')) {
      url = url.replace('stream', 'screenshot');
    } else if (useStream && url.includes('screenshot')) {
      url = url.replace('screenshot', 'stream');
    }
    
    setDisplayedWebcamUrl(url);
    
    // If using proxy, route through our proxy endpoint
    if (useProxy) {
      return `/api/webcam-proxy?url=${encodeURIComponent(url)}&snapshot=${!useStream}&t=${timestamp}`;
    }
    
    // Direct URL with timestamp to prevent caching
    return `${url}${url.includes('?') ? '&' : '?'}t=${timestamp}`;
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Webcam Debug Page</h1>
      
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md mb-6 text-red-700">
          {errorMessage}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Select Printer</label>
            <select
              className="w-full p-2 border rounded"
              value={selectedPrinter?.id || ""}
              onChange={(e) => {
                const printer = printers.find(p => p.id === e.target.value);
                setSelectedPrinter(printer || null);
                setCustomWebcamUrl("");
              }}
            >
              {printers.map(printer => (
                <option key={printer.id} value={printer.id}>
                  {printer.name} ({printer.type})
                </option>
              ))}
            </select>
          </div>
          
          {selectedPrinter && (
            <div className="mb-4 p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Printer Info</h3>
              <p>Name: {selectedPrinter.name}</p>
              <p>Type: {selectedPrinter.type}</p>
              <p>Status: {selectedPrinter.operationalStatus}</p>
              <p>Webcam URL: {selectedPrinter.webcamUrl || "None"}</p>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Custom Webcam URL (overrides printer selection)</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={customWebcamUrl}
              onChange={(e) => setCustomWebcamUrl(e.target.value)}
              placeholder="e.g., http://192.168.1.100:8080/webcam/?action=stream"
            />
          </div>
          
          <div className="mb-4 flex gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useStream"
                checked={useStream}
                onChange={(e) => setUseStream(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="useStream">Use Stream (vs. Snapshot)</label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useProxy"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="useProxy">Use Proxy</label>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium mb-2">URL Being Used:</h3>
            <div className="bg-gray-100 p-2 rounded-md break-all text-sm">
              {displayedWebcamUrl || "No URL configured"}
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium mb-2">Display URL:</h3>
            <div className="bg-gray-100 p-2 rounded-md break-all text-sm">
              {getDisplayUrl() || "No URL configured"}
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Webcam Display</h2>
          
          {getCurrentWebcamUrl() ? (
            <div>
              <div className="mb-6 bg-black rounded-md overflow-hidden aspect-video relative">
                {useProxy ? (
                  <img
                    src={getDisplayUrl()}
                    alt="Webcam"
                    className="w-full h-full object-contain"
                    onError={() => setErrorMessage("Failed to load webcam image")}
                  />
                ) : (
                  // Direct method without proxy
                  <img
                    src={`${getCurrentWebcamUrl()}${getCurrentWebcamUrl().includes('?') ? '&' : '?'}t=${timestamp}`}
                    alt="Webcam Direct"
                    className="w-full h-full object-contain" 
                  />
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Stream Test Methods</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">1. Direct IMG Tag</h4>
                      <div className="bg-black rounded-md overflow-hidden aspect-video">
                        <img
                          src={getCurrentWebcamUrl()}
                          alt="Webcam Direct IMG"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">2. Proxy IMG Tag</h4>
                      <div className="bg-black rounded-md overflow-hidden aspect-video">
                        <img
                          src={`/api/webcam-proxy?url=${encodeURIComponent(getCurrentWebcamUrl())}&t=${timestamp}`}
                          alt="Webcam Proxy IMG"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">3. IFrame Method</h4>
                      <div className="bg-black rounded-md overflow-hidden aspect-video">
                        <iframe
                          src={getDisplayUrl()}
                          title="Webcam via iframe"
                          className="w-full h-full border-0"
                        ></iframe>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">4. Video Tag Test</h4>
                      <div className="bg-black rounded-md overflow-hidden aspect-video">
                        <video
                          src={getDisplayUrl()}
                          autoPlay
                          muted
                          className="w-full h-full"
                        ></video>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Snapshot Test Methods</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">1. Direct Snapshot</h4>
                      <div className="bg-black rounded-md overflow-hidden aspect-video">
                        {getCurrentWebcamUrl() && (
                          <img
                            src={getCurrentWebcamUrl().replace('stream', 'snapshot') || getCurrentWebcamUrl().replace('stream', 'screenshot')}
                            alt="Direct Snapshot"
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">2. Proxy Snapshot</h4>
                      <div className="bg-black rounded-md overflow-hidden aspect-video">
                        {getCurrentWebcamUrl() && (
                          <img
                            src={`/api/webcam-proxy?url=${encodeURIComponent(getCurrentWebcamUrl().replace('stream', 'snapshot') || getCurrentWebcamUrl().replace('stream', 'screenshot'))}&snapshot=true&t=${timestamp}`}
                            alt="Proxy Snapshot"
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-md p-8 flex items-center justify-center text-gray-500">
              No webcam URL configured
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 