"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";

// Component that uses useSearchParams (must be wrapped in Suspense)
function FileParamsLoader({ setFileInfo, setError }: { 
  setFileInfo: (info: {fileName: string, fileUrl: string} | null) => void,
  setError: (error: string | null) => void
}) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const fileUrl = searchParams.get('file');
    const fileName = searchParams.get('name');

    if (fileUrl && fileName) {
      setFileInfo({
        fileName,
        fileUrl
      });
    } else {
      setError("No file parameters provided");
    }
  }, [searchParams, setFileInfo, setError]);
  
  return null;
}

export default function SlicerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [fileInfo, setFileInfo] = useState<{fileName: string, fileUrl: string} | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Get file information from URL parameters is now handled by FileParamsLoader

  // Function to open Kiri:Moto in a new tab
  const openInKiriMoto = () => {
    // Open Kiri:Moto in a new tab
    window.open('https://grid.space/kiri/?mode=FDM&view=arrange', '_blank');
    
    // Update the overlay to show manual upload instructions
    setOverlayVisible(true);
  };

  // Function to download the STL file
  const downloadFile = async () => {
    if (!fileInfo) return;
    
    try {
      // Use our STL proxy endpoint with full URL
      const proxyUrl = `${window.location.origin}/api/files/stl-proxy?url=${encodeURIComponent(fileInfo.fileUrl)}`;
      
      // Fetch the file
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch STL file: ${response.status} ${response.statusText}`);
      }
      
      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileInfo.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Wrap search params usage in Suspense boundary */}
      <Suspense fallback={<div>Loading file information...</div>}>
        <FileParamsLoader setFileInfo={setFileInfo} setError={setError} />
      </Suspense>
      
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">View/Edit STL in Kiri:Moto</h1>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {fileInfo ? (
            <div className="p-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6">
                <h2 className="font-semibold mb-2">File Information:</h2>
                <p><strong>Name:</strong> {fileInfo.fileName}</p>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
                <h3 className="font-semibold mb-2">Due to browser security restrictions:</h3>
                <ol className="list-decimal ml-6 space-y-2">
                  <li>Click the "Open in Kiri:Moto" button below</li>
                  <li>A new tab with Kiri:Moto will open</li>
                  <li>In the new tab, click the "Import" button in the top menu</li>
                  <li>
                    Choose one of these options:
                    <ul className="list-disc ml-6 mt-2">
                      <li>Download the file using the button below, then upload it in Kiri:Moto</li>
                      <li>Or drag and drop the downloaded file into Kiri:Moto</li>
                    </ul>
                  </li>
                </ol>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                <button
                  onClick={openInKiriMoto}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  Open in Kiri:Moto
                </button>
                
                <button
                  onClick={downloadFile}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md font-medium flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download STL File
                </button>
                
                <button
                  onClick={() => router.push('/files')}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-md font-medium flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Back to Files
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-600">No file selected or loading file information...</p>
            </div>
          )}
        </div>
        
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
            <h2 className="text-xl font-semibold mb-4">About Kiri:Moto</h2>
            <p className="text-gray-700 mb-4">
              Kiri:Moto is a powerful slicer for 3D printing, CNC machining, and laser cutting. 
              Due to browser security restrictions, we cannot automatically load files into Kiri:Moto 
              in an iframe or directly via URL. Instead, you need to manually open the file in Kiri:Moto.
            </p>
            <p className="text-gray-700">
              For more information about Kiri:Moto, visit the 
              <a href="https://grid.space/kiri" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline"> official website</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 