"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UploadFileForm } from "@/components/upload-file-form";
import { DeleteFileDialog } from "@/components/delete-file-dialog";
import { FileInfoDialog } from "@/components/file-info-dialog";
import { PrintFileDialog } from "@/components/print-file-dialog";
import { PlusIcon, XMarkIcon, InformationCircleIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { GcodePreview } from "@/components/gcode-preview";

type File = {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  previewUrl: string | null;
  uploadedAt: Date;
  updatedAt: Date;
  uploadedBy: string;
  groupId: string | null;
  group: {
    id: string;
    name: string;
  } | null;
  printJobs: {
    id: string;
    status: string;
    createdAt: Date;
    printer: {
      id: string;
      name: string;
    };
  }[];
};

export default function FilesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deletingFile, setDeletingFile] = useState<File | null>(null);
  const [viewingFileInfo, setViewingFileInfo] = useState<File | null>(null);
  const [printingFile, setPrintingFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchFiles();
    }
  }, [status]);

  const handleUploadFile = async (file: File) => {
    setFiles(prev => [file, ...prev]);
    setShowUploadForm(false);
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete file');
      
      setFiles(prev => prev.filter(f => f.id !== fileId));
      setDeletingFile(null);
      setViewingFileInfo(null);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Files</h1>
        <button
          onClick={() => setShowUploadForm(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Upload G/BGcode
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2 pl-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredFiles.map((file) => (
          <div
            key={file.id}
            className="rounded-lg border bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-lg font-semibold">{file.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
                
                {file.group && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Group:</span>
                    <span className="text-sm text-gray-700">{file.group.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Uploaded:</span>
                  <span className="text-xs text-gray-600">
                    {new Date(file.uploadedAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Show 3D viewer for both STL files with previewUrl and any GCODE/BGCODE files */}
                  {((file.name.toLowerCase().endsWith('.stl') && file.previewUrl) || 
                    file.name.toLowerCase().endsWith('.gcode') ||
                    file.name.toLowerCase().endsWith('.bgcode')) && (
                    <GcodePreview 
                      gcodeUrl={
                        // For GCODE/BGCODE files, go through our GCODE API that handles auth and CORS
                        file.name.toLowerCase().endsWith('.gcode') || file.name.toLowerCase().endsWith('.bgcode')
                          ? `/api/files/gcode/${encodeURIComponent(file.id)}`
                          : (file.previewUrl || `/api/files/${file.id}/preview`)
                      } 
                      fileName={file.name}
                      fileId={file.id} 
                    />
                  )}
                  
                  {(file.name.toLowerCase().endsWith('.gcode') || file.name.toLowerCase().endsWith('.bgcode')) && (
                    <button
                      onClick={() => setPrintingFile(file)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <PrinterIcon className="h-4 w-4 mr-1" />
                      Print
                    </button>
                  )}

                  {file.name.toLowerCase().endsWith('.bgcode') && (
                    <div className="flex items-center text-xs space-x-1">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">PrusaLink compatible</span>
                    </div>
                  )}

                  {file.name.toLowerCase().endsWith('.gcode') && (
                    <div className="flex items-center text-xs space-x-1">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Moonraker compatible</span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setViewingFileInfo(file)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    <InformationCircleIcon className="h-4 w-4 mr-1" />
                    Info
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredFiles.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-center text-gray-500">
            {searchQuery ? "No files found matching your search." : "No files found."}
          </div>
        )}
      </div>

      {/* Upload File Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowUploadForm(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Upload New G/BGcode</h2>
                </div>
                <UploadFileForm onUpload={handleUploadFile} />
                <div className="mt-4">
                  <button
                    onClick={() => setShowUploadForm(false)}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Info Modal */}
      {viewingFileInfo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setViewingFileInfo(null)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <FileInfoDialog
                  file={viewingFileInfo}
                  onClose={() => setViewingFileInfo(null)}
                  onDelete={handleDeleteFile}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print File Modal */}
      {printingFile && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setPrintingFile(null)}></div>
            </div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <PrintFileDialog
                  fileName={printingFile.name}
                  fileId={printingFile.id}
                  onClose={() => setPrintingFile(null)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 