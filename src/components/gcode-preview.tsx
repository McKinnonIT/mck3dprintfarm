"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { CubeIcon } from "@heroicons/react/24/outline";

// Configuration
const LOCAL_KIRI_URL = 'http://localhost:8080';
const REMOTE_KIRI_URL = 'https://grid.space';

interface GcodePreviewProps {
  gcodeUrl: string;
  fileName: string;
  fileId: string;
}

export function GcodePreview({ gcodeUrl, fileName, fileId }: GcodePreviewProps) {
  const [showModal, setShowModal] = useState(false);
  const [kirimotoBaseUrl, setKirimotoBaseUrl] = useState<string>(REMOTE_KIRI_URL); // Default to remote
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [iframeUrl, setIframeUrl] = useState<string>("");
  const urlGenerated = useRef<string>("");
  
  // Debug logging function - memoized to prevent re-renders
  const addLog = useCallback((message: string) => {
    console.log(`[GcodePreview] ${message}`);
    setDebugLog(prev => [...prev, message]);
  }, []);
  
  // Check if local Kiri:Moto is available
  useEffect(() => {
    let isMounted = true;
    
    async function checkLocalKiriMoto() {
      try {
        addLog("Checking local Kiri:Moto...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        // Use no-cors mode to bypass CORS errors
        const response = await fetch(`${LOCAL_KIRI_URL}/kiri/`, { 
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // When using no-cors, the response type is "opaque" and status is always 0,
        // so we just check if we got a response at all
        if (isMounted) {
          // If we reach here, it means the request didn't throw an error,
          // suggesting the local server is reachable
          addLog("Local Kiri:Moto appears to be available");
          setKirimotoBaseUrl(LOCAL_KIRI_URL);
        }
      } catch (error) {
        if (isMounted) {
          addLog("Local Kiri:Moto error: " + (error instanceof Error ? error.message : String(error)));
          addLog("Using remote Kiri:Moto at grid.space");
          setKirimotoBaseUrl(REMOTE_KIRI_URL);
        }
      }
    }
    
    checkLocalKiriMoto();
    
    return () => {
      isMounted = false;
    };
  }, [addLog]);
  
  // Reset errors when URL changes
  useEffect(() => {
    if (showModal) {
      setLoadingError(false);
      setIsLoading(true);
    }
  }, [kirimotoBaseUrl, showModal]);
  
  // Set a timeout for loading
  useEffect(() => {
    if (!showModal) return;
    
    // Use a simpler timeout approach
    const timer = setTimeout(() => {
      if (isLoading) {
        addLog("Loading timeout - hiding spinner");
        setIsLoading(false);
      }
    }, 8000); // 8 seconds is enough since we're also hiding in the iframe load handler
    
    return () => clearTimeout(timer);
  }, [isLoading, showModal, addLog]);
  
  // Generate KiriMoto URL based on file type
  const generateKiriUrl = useCallback(async () => {
    // For STL files, check if we can use CLI mode with local Kiri:Moto
    if (fileName.toLowerCase().endsWith('.stl') && kirimotoBaseUrl === LOCAL_KIRI_URL && fileId) {
      try {
        // Fetch the Docker path from our API
        addLog('Fetching Docker path for CLI mode...');
        const response = await fetch(`/api/files/docker-path?id=${encodeURIComponent(fileId)}`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Get the original file name from the path
          const originalFileName = data.fileName;
          
          // The simplest strategy tends to work best - try just using the filename directly
          addLog(`Using CLI mode with simple file path: ${originalFileName}`);
          return `${kirimotoBaseUrl}/kiri/?cli=load&model=${encodeURIComponent(`/uploads/${originalFileName}`)}&mode=FDM&view=arrange`;
        } else {
          addLog('Failed to get Docker path, falling back to direct loading');
        }
      } catch (error) {
        addLog(`Error fetching Docker path: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const fileNameLower = fileName.toLowerCase();
    
    // Fallback to basic URL generation
    if (fileNameLower.endsWith('.stl')) {
      // For STL files, load without parameters
      return `${kirimotoBaseUrl}/kiri/?mode=FDM&view=arrange`;
    } else if (fileNameLower.endsWith('.gcode') || fileNameLower.endsWith('.bgcode')) {
      // For GCODE/BGCODE files, include the load URL
      const fullUrl = gcodeUrl.startsWith('http') 
        ? gcodeUrl 
        : window.location.origin + (gcodeUrl.startsWith('/') ? '' : '/') + gcodeUrl;
      
      // Pass the GCODE URL to Kiri:Moto
      return `${kirimotoBaseUrl}/kiri/?load=${encodeURIComponent(fullUrl)}&mode=FDM&view=arrange`;
    }
    
    // Fallback URL
    return `${kirimotoBaseUrl}/kiri/?mode=FDM&view=arrange`;
  }, [fileName, gcodeUrl, kirimotoBaseUrl, fileId, addLog]);
  
  // Function to fetch STL file as binary data
  const fetchStlFile = useCallback(async (url: string): Promise<ArrayBuffer> => {
    addLog(`Fetching STL file from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/octet-stream, model/stl, */*',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch STL: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    addLog(`STL file fetched successfully, size: ${buffer.byteLength} bytes`);
    
    return buffer;
  }, [addLog]);
  
  // Function to convert ArrayBuffer to Base64
  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
  }, []);
  
  // Function to send STL file to Kiri:Moto via postMessage
  const sendStlToKiriMoto = useCallback(async () => {
    if (!fileName.toLowerCase().endsWith('.stl')) return;
    
    try {
      addLog('Preparing to send STL to Kiri:Moto...');
      
      // Get the iframe element
      const iframe = document.querySelector('iframe');
      if (!iframe || !iframe.contentWindow) {
        addLog('Cannot find iframe or content window');
        return;
      }
      
      // Get file URL
      let fileUrl = gcodeUrl;
      if (!fileUrl.startsWith('http')) {
        fileUrl = window.location.origin + (fileUrl.startsWith('/') ? '' : '/') + fileUrl;
      }
      
      // Use the STL proxy
      let stlUrl = fileUrl;
      if (fileId) {
        stlUrl = `${window.location.origin}/api/files/stl-proxy?id=${encodeURIComponent(fileId)}`;
      } else if (fileUrl.includes('/api/files/') && !fileUrl.includes('/stl-proxy')) {
        stlUrl = `${window.location.origin}/api/files/stl-proxy?url=${encodeURIComponent(fileUrl)}`;
      }
      
      // Fetch the STL file
      addLog(`Fetching STL from: ${stlUrl}`);
      const stlData = await fetchStlFile(stlUrl);
      
      // Convert to Base64
      const base64Data = arrayBufferToBase64(stlData);
      addLog(`STL file converted to base64 (${base64Data.length} chars)`);
      
      // Parse the Kiri:Moto URL to get origin
      const kirimotoUrl = new URL(kirimotoBaseUrl);
      const targetOrigin = kirimotoUrl.origin;
      
      addLog(`Sending STL to Kiri:Moto at ${targetOrigin}...`);
      iframe.contentWindow.postMessage({
        kiri: true,
        load: {
          name: fileName,
          data: base64Data,
          type: 'stl',
          mode: 'FDM'
        }
      }, targetOrigin);
      
      addLog('STL data sent to Kiri:Moto');
    } catch (error) {
      console.error('Error sending STL to Kiri:Moto:', error);
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setLoadingError(true);
    }
  }, [fileName, gcodeUrl, fileId, kirimotoBaseUrl, fetchStlFile, arrayBufferToBase64, addLog]);
  
  // Load GCODE file into KiriMoto via postMessage after iframe loads
  useEffect(() => {
    if (!showModal || !iframeUrl) {
      return;
    }
    
    // Add logging for URL generated
    addLog(`Using iframe URL: ${iframeUrl}`);
  }, [showModal, iframeUrl, addLog]);
  
  // Generate the iframe URL when needed
  useEffect(() => {
    if (!showModal) {
      setIframeUrl("");
      return;
    }
    
    let isMounted = true;
    
    const getUrl = async () => {
      try {
        addLog("Generating Kiri:Moto URL...");
        const url = await generateKiriUrl();
        
        if (isMounted) {
          setIframeUrl(url);
          addLog(`Generated iframe URL: ${url}`);
        }
      } catch (error) {
        console.error("Error generating URL:", error);
        if (isMounted) {
          addLog(`Error generating URL: ${error instanceof Error ? error.message : String(error)}`);
              setLoadingError(true);
        }
      }
    };
    
    getUrl();
    
    return () => {
      isMounted = false;
    };
  }, [showModal, generateKiriUrl, addLog]);
  
  // Handle iframe events
  const handleIframeLoad = useCallback(() => {
    addLog("Iframe loaded successfully");
    
    // Always hide the loading spinner once the iframe has loaded
    // This ensures we don't get stuck on the loading screen
    setIsLoading(false);
  }, [addLog]);
  
  const handleIframeError = useCallback((error: any) => {
    console.error("Iframe error:", error);
    addLog(`Error loading iframe: ${error?.message || 'Unknown error'}`);
    setIsLoading(false);
    setLoadingError(true);
  }, [addLog]);
  
  // Handle switching from local to remote server
  const switchToRemote = useCallback(() => {
    addLog("Switching to remote Kiri:Moto server");
    setKirimotoBaseUrl(REMOTE_KIRI_URL);
    setIsLoading(true);
    setLoadingError(false);
  }, [addLog]);
  
  // Get a direct file download URL
  const getDownloadUrl = useCallback(() => {
    return gcodeUrl.startsWith('/') ? window.location.origin + gcodeUrl : gcodeUrl;
  }, [gcodeUrl]);

  // Add a function to help user open the STL file in a new tab for diagnostic purposes
  const openStlInNewTab = useCallback(() => {
    if (fileName.toLowerCase().endsWith('.stl')) {
      const stlProxyUrl = fileId 
        ? `${window.location.origin}/api/files/stl-proxy?id=${encodeURIComponent(fileId)}`
        : `${window.location.origin}/api/files/stl-proxy?url=${encodeURIComponent(gcodeUrl)}`;
      
      window.open(stlProxyUrl, '_blank');
      addLog(`Opened STL file in new tab: ${stlProxyUrl}`);
    }
  }, [fileName, fileId, gcodeUrl, addLog]);

  // Add function to generate and open a CLI URL in a new tab
  const openCliUrlInNewTab = useCallback(async () => {
    if (!fileName.toLowerCase().endsWith('.stl') || !fileId) return;
    
    try {
      // Fetch the Docker path
      addLog('Fetching Docker path for direct CLI test...');
      const response = await fetch(`/api/files/docker-path?id=${encodeURIComponent(fileId)}`);
      
      if (!response.ok) {
        addLog(`Failed to get Docker path: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      addLog(`File info: ${JSON.stringify(data, null, 2)}`);
      
      // Get a full URL to the STL file
      const stlProxyUrl = `${window.location.origin}/api/files/stl-proxy?id=${encodeURIComponent(fileId)}`;
      
      // The file paths we'll try
      const originalFileName = data.fileName;
      const localFileName = data.originalPath.split('/').pop();
      
      // Create additional Docker path options based on the logs
      // We'll create several variations to try to find one that works
      const dockerPathOptions = [
        // Option 1: Full path as in Docker container (from API)
        data.dockerPath,
        
        // Option 2: Try with just the filename
        `/uploads/${originalFileName}`,
        
        // Option 3: Use a simple path with the timestamp prefix
        `/uploads/${localFileName}`,
        
        // Option 4: Use direct relative path from logs
        `/uploads${data.relativeFilePath}`,
        
        // Option 5: Try a very simple path (just the filename)
        `${originalFileName}`
      ];
      
      // Try different CLI approaches
      const cliOptions = [];
      
      // CLI load with direct model paths
      dockerPathOptions.forEach((path, index) => {
        cliOptions.push({
          name: `CLI Path ${index + 1}`,
          url: `${LOCAL_KIRI_URL}/kiri/?cli=load&model=${encodeURIComponent(path)}&mode=FDM&view=arrange`
        });
      });
      
      // Try using file parameter
      dockerPathOptions.forEach((path, index) => {
        cliOptions.push({
          name: `File Param ${index + 1}`,
          url: `${LOCAL_KIRI_URL}/kiri/?file=${encodeURIComponent(path)}&mode=FDM&view=arrange`
        });
      });
      
      // Try using filename directly
      cliOptions.push({
        name: `Base Filename`,
        url: `${LOCAL_KIRI_URL}/kiri/?file=${encodeURIComponent(originalFileName)}&mode=FDM&view=arrange`
      });
      
      // HTTP load parameter as last resort
      cliOptions.push({
        name: "HTTP URL",
        url: `${LOCAL_KIRI_URL}/kiri/?load=${encodeURIComponent(stlProxyUrl)}&mode=FDM&view=arrange`
      });
      
      // Open each option in a new tab (limit to first 5 to avoid tab explosion)
      cliOptions.slice(0, 5).forEach(option => {
        addLog(`Opening ${option.name} URL: ${option.url}`);
        window.open(option.url, `_blank_${option.name}`);
      });
      
      // Log all URLs for reference
      cliOptions.forEach(option => {
        addLog(`${option.name}: ${option.url}`);
      });
      
    } catch (error) {
      addLog(`Error opening CLI URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [fileName, fileId, addLog]);

  // Handle Kiri:Moto initialization and events
  useEffect(() => {
    if (!showModal || !iframeUrl) return;
    
    // Track if Kiri:Moto has been initialized
    let kiriInitialized = false;
    
    const handleIframeMessage = (event: MessageEvent) => {
      // Make sure the message is from Kiri:Moto
      if (event.data && event.data.kiri) {
        console.log('Received message from Kiri:Moto iframe:', event.data);
        
        // Handle specific events
        if (event.data.event) {
          addLog(`Kiri:Moto event: ${event.data.event}`);
          
          if (event.data.event === 'init-done') {
            addLog('Kiri:Moto initialized');
            kiriInitialized = true;
            setIsLoading(false);
          }
          
          // Handle important events
          switch (event.data.event) {
            case 'widget.add':
              addLog('Model successfully loaded in Kiri:Moto');
              setIsLoading(false);
              break;
            case 'slice.end':
              addLog('Slicing completed');
              setIsLoading(false);
              break;
            case 'slice.error':
              addLog('Error during slicing');
              setLoadingError(true);
              break;
            case 'platform.loaded':
              addLog('Platform loaded');
              break;
            case 'load.error':
              addLog('Error loading model');
              setLoadingError(true);
              break;
          }
        }
      }
    };
    
    // Add event listener for postMessages from Kiri:Moto
    window.addEventListener('message', handleIframeMessage);
    
    // Clean up
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, iframeUrl, fileName, addLog]);

  // Function to load STL file into Kiri:Moto using direct URL loading
  const loadStlWithDirectUrl = useCallback(async () => {
    if (!fileName.toLowerCase().endsWith('.stl')) return;
    
    try {
      addLog('Attempting to load STL via direct URL...');
      setIsLoading(true);
      
      // Create URL for the STL file
      const stlProxyUrl = fileId 
        ? `${window.location.origin}/api/files/stl-proxy?id=${encodeURIComponent(fileId)}`
        : `${window.location.origin}/api/files/stl-proxy?url=${encodeURIComponent(gcodeUrl)}`;
      
      addLog(`Using STL URL: ${stlProxyUrl}`);
      
      // Wait for a short delay to ensure Kiri:Moto is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set the iframe URL directly with the load parameter
      const encodedUrl = encodeURIComponent(stlProxyUrl);
      const newUrl = `${kirimotoBaseUrl}/kiri/?load=${encodedUrl}&mode=FDM&view=arrange&platform=bed`;
      setIframeUrl(newUrl);
      
      addLog('STL URL loaded into iframe');
    } catch (error) {
      addLog(`Error loading STL with direct URL: ${error instanceof Error ? error.message : String(error)}`);
      setLoadingError(true);
      setIsLoading(false);
    }
  }, [fileName, fileId, gcodeUrl, kirimotoBaseUrl, addLog]);

  // Function to load STL file into Kiri:Moto using postMessage API
  const loadStlWithPostMessage = useCallback(async () => {
    if (!fileName.toLowerCase().endsWith('.stl')) return;
    
    try {
      addLog('Attempting to load STL via postMessage API...');
      setIsLoading(true);
      
      // Get the iframe element
      const iframe = document.querySelector('iframe');
      if (!iframe || !iframe.contentWindow) {
        addLog('Cannot find iframe or content window');
        return;
      }
      
      // Create URL for the STL file
      const stlProxyUrl = fileId 
        ? `${window.location.origin}/api/files/stl-proxy?id=${encodeURIComponent(fileId)}`
        : `${window.location.origin}/api/files/stl-proxy?url=${encodeURIComponent(gcodeUrl)}`;
      
      addLog(`Using STL URL: ${stlProxyUrl}`);
      
      // Wait for a short delay to ensure Kiri:Moto is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use postMessage to communicate with the iframe
      const kirimotoUrl = new URL(kirimotoBaseUrl);
      const targetOrigin = kirimotoUrl.origin;
      
      addLog(`Sending load request to Kiri:Moto at ${targetOrigin}...`);
      iframe.contentWindow.postMessage({
        kiri: true,
        load: {
          name: fileName,
          url: stlProxyUrl,
          type: 'stl',
          mode: 'FDM',
          view: 'arrange'
        }
      }, targetOrigin);
      
      addLog('STL load request sent to Kiri:Moto');
    } catch (error) {
      addLog(`Error loading STL with postMessage: ${error instanceof Error ? error.message : String(error)}`);
      setLoadingError(true);
      setIsLoading(false);
    }
  }, [fileName, fileId, gcodeUrl, kirimotoBaseUrl, addLog]);

  // Function to load STL file into Kiri:Moto using binary data
  const loadStlWithBinaryData = useCallback(async () => {
    if (!fileName.toLowerCase().endsWith('.stl')) return;
    
    try {
      addLog('Loading STL as binary data...');
      setIsLoading(true);
      
      // Get the iframe element
      const iframe = document.querySelector('iframe');
      if (!iframe || !iframe.contentWindow) {
        addLog('Cannot find iframe or content window');
        return;
      }
      
      // Create URL for the STL file
      const stlProxyUrl = fileId 
        ? `${window.location.origin}/api/files/stl-proxy?id=${encodeURIComponent(fileId)}`
        : `${window.location.origin}/api/files/stl-proxy?url=${encodeURIComponent(gcodeUrl)}`;
      
      addLog(`Fetching STL binary data from: ${stlProxyUrl}`);
      const stlData = await fetchStlFile(stlProxyUrl);
      
      // Convert to Base64
      const base64Data = arrayBufferToBase64(stlData);
      addLog(`STL file converted to base64 (${base64Data.length} chars)`);
      
      // Wait for a short delay to ensure Kiri:Moto is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Parse the Kiri:Moto URL
      const kirimotoUrl = new URL(kirimotoBaseUrl);
      const targetOrigin = kirimotoUrl.origin;
      
      addLog(`Sending binary STL data to Kiri:Moto at ${targetOrigin}...`);
      iframe.contentWindow.postMessage({
        kiri: true,
        load: {
          name: fileName,
          data: base64Data,
          type: 'stl',
          mode: 'FDM',
          view: 'arrange'
        }
      }, targetOrigin);
      
      addLog('Binary STL data sent to Kiri:Moto');
    } catch (error) {
      addLog(`Error loading binary STL: ${error instanceof Error ? error.message : String(error)}`);
      setLoadingError(true);
      setIsLoading(false);
    }
  }, [fileName, fileId, gcodeUrl, kirimotoBaseUrl, fetchStlFile, arrayBufferToBase64, addLog]);

  // Function to load STL file into Kiri:Moto using CLI mode
  const loadStlWithCliMode = useCallback(async () => {
    if (!fileName.toLowerCase().endsWith('.stl') || !fileId) return;
    
    try {
      addLog('Attempting to load STL via CLI mode...');
      setIsLoading(true);
      
      // Fetch the Docker path
      addLog('Fetching Docker path for CLI mode...');
      const response = await fetch(`/api/files/docker-path?id=${encodeURIComponent(fileId)}`);
      
      if (!response.ok) {
        addLog(`Failed to get Docker path: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      addLog(`File info: ${JSON.stringify(data, null, 2)}`);
      
      // Use the Docker container path with /app/uploads prefix
      const dockerPath = `/app/uploads/${data.fileName}`;
      addLog(`Using Docker container path: ${dockerPath}`);
      
      // Wait for a short delay to ensure Kiri:Moto is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use CLI mode with the Docker container path
      const cliUrl = `${kirimotoBaseUrl}/kiri/?cli=load&model=${encodeURIComponent(dockerPath)}&mode=FDM&view=arrange`;
      addLog(`Using CLI URL: ${cliUrl}`);
      
      // Set the URL directly without checking for redirect
      // The iframe will handle the redirect automatically
      setIframeUrl(cliUrl);
      
      addLog('CLI URL set in iframe');
    } catch (error) {
      addLog(`Error loading STL with CLI mode: ${error instanceof Error ? error.message : String(error)}`);
      setLoadingError(true);
      setIsLoading(false);
    }
  }, [fileName, fileId, kirimotoBaseUrl, addLog]);

  const openInKiriMoto = () => {
    // Encode the file URL and name as query parameters
    const params = new URLSearchParams({
      file: gcodeUrl,
      name: fileName
    });
    
    // Navigate to the slicer page with the file parameters
    window.location.href = `/slicer?${params.toString()}`;
  };

  return (
    <>
      <button
        onClick={openInKiriMoto}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <CubeIcon className="h-4 w-4 mr-1" />
        View/Edit in Kiri:Moto
      </button>

      {/* 3D Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowModal(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-4/5 sm:max-w-[85vw] sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{fileName}</h2>
                    {fileName.toLowerCase().endsWith('.stl') && (
                      <div className="flex gap-2 ml-4">
                        <button 
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                          onClick={loadStlWithDirectUrl}
                        >
                          Direct URL
                        </button>
                        <button 
                          className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                          onClick={loadStlWithPostMessage}
                        >
                          postMessage
                        </button>
                        <button 
                          className="bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded text-xs"
                          onClick={loadStlWithBinaryData}
                        >
                          Binary
                        </button>
                        {kirimotoBaseUrl === LOCAL_KIRI_URL && fileId && (
                          <button 
                            className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                            onClick={loadStlWithCliMode}
                          >
                            CLI Mode
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      onClick={switchToRemote}
                    >
                      Remote Kiri:Moto
                    </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    Close
                  </button>
                  </div>
                </div>
                
                <div className="h-[70vh] w-full relative">
                  {/* Loading spinner */}
                  {(isLoading || loadingError) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                      <div className="flex flex-col items-center max-w-md text-center">
                        {!loadingError ? (
                          <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-gray-600 mb-6">
                              {fileName.toLowerCase().endsWith('.stl') 
                                ? "Kiri:Moto is loading. Choose a loading method from the top." 
                                : "Loading 3D viewer..."}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              {fileName.toLowerCase().endsWith('.stl') && (
                            <button 
                                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                                  onClick={openStlInNewTab}
                            >
                                  View STL Directly
                            </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load 3D viewer</h3>
                            <p className="text-gray-600 mb-6">
                              {kirimotoBaseUrl === LOCAL_KIRI_URL 
                                ? "We couldn't connect to the local Kiri:Moto server." 
                                : "We couldn't load the 3D viewer."}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              {kirimotoBaseUrl === LOCAL_KIRI_URL && (
                                <button 
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                  onClick={switchToRemote}
                                >
                                  Try Remote Server
                                </button>
                              )}
                              <a 
                                href={getDownloadUrl()} 
                                download
                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                              >
                                Download File
                              </a>
                              <a 
                                href={`${kirimotoBaseUrl === LOCAL_KIRI_URL ? REMOTE_KIRI_URL : LOCAL_KIRI_URL}/kiri/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm"
                              >
                                Open Kiri:Moto Directly
                              </a>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Viewer iframe */}
                  {iframeUrl && (
                    <iframe 
                      key={iframeUrl} // Use URL as key instead of timestamp
                      src={iframeUrl}
                      className="w-full h-full border-0"
                      title={`3D Viewer: ${fileName}`}
                      allowFullScreen
                      allow="clipboard-write"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      referrerPolicy="origin"
                      onLoad={handleIframeLoad}
                      onError={handleIframeError}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 