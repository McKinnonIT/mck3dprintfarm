"use client";

import React, { useState } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

type UploadFileFormProps = {
  onUploadSuccess: (file: any) => void;
  allowedFileTypes: string[];
  onClose: () => void;
};

export function UploadFileForm({ 
  onUploadSuccess, 
  allowedFileTypes = [],
  onClose 
}: UploadFileFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptString = allowedFileTypes.join(",");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0] || null;
      if (selectedFile) {
          const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
          if (allowedFileTypes.length > 0 && !allowedFileTypes.includes(fileExtension)) {
              setError(`Invalid file type. Allowed types: ${allowedFileTypes.join(', ')}`);
              setFile(null);
          } else {
              setError(null);
              setFile(selectedFile);
          }
      } else {
          setFile(null);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload file');
      }

      const uploadedFile = await response.json();
      onUploadSuccess(uploadedFile);
      setFile(null);
      onClose();
    } catch (err) {
      console.error('Failed to upload file:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.257 7.303c.22.22.287.624.152.924l-1.5 3.5a.75.75 0 001.486.64l1.5-3.5a.75.75 0 00-.924-.924L10 8.586l-1.743-1.283zm5.486 0c-.22.22-.287.624-.152.924l1.5 3.5a.75.75 0 101.486-.64l-1.5-3.5a.75.75 0 00-.924-.924L10 8.586l1.743-1.283z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-foreground">
          Select File
        </label>
        <input
          type="file"
          id="file"
          onChange={handleFileChange}
          accept={acceptString}
          className="mt-1 block w-full text-sm text-muted-foreground
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
          required
        />
        {file && (
          <p className="mt-1 text-sm text-muted-foreground">
            Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
         {!file && !error && (
             <p className="mt-1 text-xs text-muted-foreground">
                Allowed types: {acceptString || "(None configured)"}
             </p>
         )}
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!file || isUploading}
            className={!file || isUploading ? 'cursor-not-allowed opacity-50' : ''}
          >
            {isUploading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Uploading...
              </span>
            ) : (
              <>
                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                Upload File
              </>
            )}
          </Button>
      </div>
    </form>
  );
}