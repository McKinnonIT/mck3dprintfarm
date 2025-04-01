"use client";

import React, { useState, useEffect } from "react";
import { PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { DeleteGroupDialog } from "./delete-group-dialog";

type Printer = {
  id: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
};

type Group = {
  id: string;
  name: string;
  description?: string;
  printers: Printer[];
};

type GroupUpdate = {
  name: string;
  description?: string;
  printerIds?: string[];
};

type EditGroupFormProps = {
  group: Group;
  onSave: (group: GroupUpdate) => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function EditGroupForm({ group, onSave, onCancel, onDelete }: EditGroupFormProps) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinters, setSelectedPrinters] = useState<string[]>(
    group.printers.map((p) => p.id)
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const response = await fetch("/api/printers");
        if (!response.ok) throw new Error("Failed to fetch printers");
        const data = await response.json();
        setPrinters(data);
      } catch (error) {
        console.error("Failed to fetch printers:", error);
      }
    };

    fetchPrinters();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      printerIds: selectedPrinters,
    });
  };

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    onDelete();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Printers
          </label>
          <div className="space-y-2">
            {printers.map((printer) => (
              <div key={printer.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`printer-${printer.id}`}
                  checked={selectedPrinters.includes(printer.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPrinters([...selectedPrinters, printer.id]);
                    } else {
                      setSelectedPrinters(selectedPrinters.filter((id) => id !== printer.id));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor={`printer-${printer.id}`}
                  className="ml-2 block text-sm text-gray-900"
                >
                  {printer.name} ({printer.operationalStatus})
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete Group
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <CheckIcon className="h-4 w-4 mr-1" />
            Save Changes
          </button>
        </div>
      </form>

      {showDeleteDialog && (
        <div className="mt-4">
          <DeleteGroupDialog
            groupName={group.name}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteDialog(false)}
          />
        </div>
      )}
    </>
  );
} 