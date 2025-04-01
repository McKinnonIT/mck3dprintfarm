"use client";

import React, { useState, useEffect } from "react";

type Printer = {
  id: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
};

type Group = {
  name: string;
  description?: string;
  printerIds?: string[];
};

type AddGroupFormProps = {
  onAdd: (group: Group) => void;
};

export function AddGroupForm({ onAdd }: AddGroupFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinters, setSelectedPrinters] = useState<string[]>([]);

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
    onAdd({
      name,
      description,
      printerIds: selectedPrinters,
    });
  };

  return (
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Add Group
        </button>
      </div>
    </form>
  );
} 