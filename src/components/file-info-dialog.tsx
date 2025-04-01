"use client";

import React, { useState } from "react";
import { InformationCircleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { DeleteFileDialog } from "@/components/delete-file-dialog";

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

type FileInfoDialogProps = {
  file: File;
  onClose: () => void;
  onDelete: (fileId: string) => void;
};

export function FileInfoDialog({ file, onClose, onDelete }: FileInfoDialogProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDeleteConfirm = () => {
    onDelete(file.id);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-xl font-semibold">{file.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{file.type}</p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700">File Size</h3>
              <p className="text-sm text-gray-900">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700">Uploaded By</h3>
              <p className="text-sm text-gray-900">{file.uploadedBy}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Uploaded At</h3>
              <p className="text-sm text-gray-900">{new Date(file.uploadedAt).toLocaleString()}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700">Last Updated</h3>
              <p className="text-sm text-gray-900">{new Date(file.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          {file.group && (
            <div className="mt-2">
              <h3 className="text-sm font-medium text-gray-700">Group</h3>
              <p className="text-sm text-gray-900">{file.group.name}</p>
            </div>
          )}

          {file.printJobs && file.printJobs.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Print History</h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {file.printJobs.map((job) => (
                  <li key={job.id} className="text-sm">
                    <span className="text-gray-900">{job.printer.name}</span>
                    <span className="text-gray-500 mx-1">•</span>
                    <span className={`${
                      job.status === 'completed' ? 'text-green-600' : 
                      job.status === 'failed' ? 'text-red-600' : 
                      job.status === 'printing' ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {job.status}
                    </span>
                    <span className="text-gray-500 mx-1">•</span>
                    <span className="text-gray-500">{new Date(job.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete File
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Close
          </button>
        </div>
      </div>

      {showDeleteDialog && (
        <DeleteFileDialog
          fileName={file.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </>
  );
} 