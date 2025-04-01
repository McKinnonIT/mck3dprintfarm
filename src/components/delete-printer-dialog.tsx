"use client";

import React, { useState } from "react";
import { TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

type DeletePrinterDialogProps = {
  printerName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeletePrinterDialog({ printerName, onConfirm, onCancel }: DeletePrinterDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmation !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }
    onConfirm();
  };

  return (
    <div className="space-y-4">
      <div className="text-red-600">
        <p className="font-medium">Warning: This action cannot be undone!</p>
        <p className="text-sm mt-1">
          To delete printer "{printerName}", please type DELETE in the box below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700">
            Type DELETE to confirm
          </label>
          <input
            type="text"
            id="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            className="mt-1 block w-full rounded-md border-2 border-gray-400 px-3 py-2 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
            required
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            className="flex-1 bg-red-600 hover:bg-red-700 inline-flex items-center"
            disabled={confirmation !== "DELETE"}
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete Printer
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1 inline-flex items-center"
            onClick={onCancel}
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
} 