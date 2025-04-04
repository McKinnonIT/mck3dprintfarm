"use client";

import React, { useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

type Printer = {
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  serialNumber?: string;
  webcamUrl?: string;
  status: string;
};

type AddPrinterFormProps = {
  onAdd: (printer: Printer) => void;
};

export function AddPrinterForm({ onAdd }: AddPrinterFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("moonraker");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [webcamUrl, setWebcamUrl] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !type || !apiUrl) {
      setError("Please fill in all required fields");
      return;
    }

    if (type === "prusalink" && !apiKey) {
      setError("API Key is required for PrusaLink printers");
      return;
    }

    if (type === "bambulab" && (!apiKey || !serialNumber)) {
      setError("Serial Number and Access Code are required for Bambu Lab printers");
      return;
    }

    onAdd({
      name,
      type,
      apiUrl,
      apiKey: (type === "prusalink" || type === "bambulab") ? apiKey : undefined,
      serialNumber: type === "bambulab" ? serialNumber : undefined,
      webcamUrl: webcamUrl || undefined,
      status: "active",
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
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        >
          <option value="moonraker">Moonraker</option>
          <option value="prusalink">PrusaLink</option>
          <option value="bambulab">Bambu Lab</option>
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        >
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      <div>
        <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-700">
          {type === "bambulab" ? "Printer IP Address" : "API URL"}
        </label>
        <input
          type={type === "bambulab" ? "text" : "url"}
          id="apiUrl"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder={type === "bambulab" ? "192.168.0.123" : "http://printer.local"}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>

      {type === "prusalink" && (
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
            API Key
          </label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
      )}

      {type === "bambulab" && (
        <>
          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700">
              Printer Serial Number
            </label>
            <input
              type="text"
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="ABCDEFG123456"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
              Access Code
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="000000"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="webcamUrl" className="block text-sm font-medium text-gray-700">
          Custom Webcam URL (Optional)
        </label>
        <input
          type="url"
          id="webcamUrl"
          value={webcamUrl}
          onChange={(e) => setWebcamUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full inline-flex items-center justify-center">
        <PlusIcon className="h-4 w-4 mr-1" />
        Add Printer
      </Button>
    </form>
  );
} 