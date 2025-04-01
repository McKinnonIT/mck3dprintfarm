"use client";

import React, { useState } from "react";
import { ExclamationTriangleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

type DeleteFileDialogProps = {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteFileDialog({
  fileName,
  onConfirm,
  onCancel,
}: DeleteFileDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Delete File
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete "{fileName}"? This action cannot be undone.
                </p>
                <div className="mt-4">
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                    Type "DELETE" to confirm
                  </label>
                  <input
                    type="text"
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="mt-1 block w-full rounded-md border-2 border-gray-400 px-3 py-2 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmText !== "DELETE"}
              className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Delete
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 