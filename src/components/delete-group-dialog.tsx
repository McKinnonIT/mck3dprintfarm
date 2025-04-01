"use client";

import React, { useState } from "react";

type DeleteGroupDialogProps = {
  groupName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteGroupDialog({ groupName, onConfirm, onCancel }: DeleteGroupDialogProps) {
  const [deleteText, setDeleteText] = useState("");
  const isDeleteEnabled = deleteText === "DELETE";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Are you sure you want to delete the group "{groupName}"? This action cannot be undone.
      </p>
      <div>
        <label htmlFor="delete-confirm" className="block text-sm font-medium text-gray-700">
          Type DELETE to confirm
        </label>
        <input
          type="text"
          id="delete-confirm"
          value={deleteText}
          onChange={(e) => setDeleteText(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Type DELETE"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!isDeleteEnabled}
          className={`rounded-md px-4 py-2 text-white ${
            isDeleteEnabled
              ? "bg-red-600 hover:bg-red-700"
              : "bg-red-400 cursor-not-allowed"
          }`}
        >
          Delete Group
        </button>
      </div>
    </div>
  );
} 