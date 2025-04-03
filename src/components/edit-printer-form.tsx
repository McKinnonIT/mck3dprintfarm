"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DeletePrinterDialog } from "@/components/delete-printer-dialog";
import { PrintJobHistory } from "@/components/print-job-history";
import { TrashIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  serialNumber?: string;
  status: string;
  operationalStatus: string;
  lastSeen: Date;
  printStartTime?: Date;
  printTimeElapsed?: number;
  printTimeRemaining?: number;
  webcamUrl?: string;
  printImageUrl?: string;
  groupId?: string;
};

type Group = {
  id: string;
  name: string;
  description?: string;
};

type EditPrinterFormProps = {
  printer: Printer;
  onSave: (printer: Omit<Printer, "id" | "lastSeen" | "operationalStatus" | "printStartTime" | "printTimeElapsed" | "printTimeRemaining" | "printImageUrl">) => void;
  onCancel: () => void;
  onDelete: () => void;
  showJobHistory?: boolean;
  onToggleJobHistory?: () => void;
};

export function EditPrinterForm({ printer, onSave, onCancel, onDelete, showJobHistory, onToggleJobHistory }: EditPrinterFormProps) {
  const [name, setName] = useState(printer.name);
  const [type, setType] = useState(printer.type);
  const [apiUrl, setApiUrl] = useState(printer.apiUrl);
  const [apiKey, setApiKey] = useState(printer.apiKey || "");
  const [serialNumber, setSerialNumber] = useState(printer.serialNumber || "");
  const [webcamUrl, setWebcamUrl] = useState(printer.webcamUrl || "");
  const [status, setStatus] = useState(printer.status);
  const [groupId, setGroupId] = useState(printer.groupId || "");
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    setName(printer.name);
    setType(printer.type);
    setApiUrl(printer.apiUrl);
    setApiKey(printer.apiKey || "");
    setSerialNumber(printer.serialNumber || "");
    setWebcamUrl(printer.webcamUrl || "");
    setStatus(printer.status);
    setGroupId(printer.groupId || "");
  }, [printer.id]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch('/api/groups');
        if (!response.ok) throw new Error('Failed to fetch groups');
        const data = await response.json();
        setGroups(data);
      } catch (error) {
        console.error('Failed to fetch groups:', error);
      }
    };

    fetchGroups();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      type,
      apiUrl,
      apiKey,
      serialNumber: type === "bambulab" ? serialNumber : undefined,
      webcamUrl,
      status,
      groupId: groupId || undefined,
    });
  };

  return (
    <div className="space-y-6">
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
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          >
            <option value="moonraker">Moonraker</option>
            <option value="prusalink">PrusaLink</option>
            <option value="bambulab">Bambu Lab</option>
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
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        {type === "bambulab" && (
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
            {type === "bambulab" ? "Access Code" : type === "prusalink" ? "API Key" : "API Key (optional)"}
          </label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required={type === "prusalink" || type === "bambulab"}
          />
        </div>

        <div>
          <label htmlFor="webcamUrl" className="block text-sm font-medium text-gray-700">
            Custom Webcam URL (optional)
          </label>
          <input
            type="url"
            id="webcamUrl"
            value={webcamUrl}
            onChange={(e) => setWebcamUrl(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <div>
          <label htmlFor="groupId" className="block text-sm font-medium text-gray-700">
            Group (optional)
          </label>
          <select
            id="groupId"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">No Group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete Printer
          </button>
          <div className="flex gap-2">
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
        </div>
      </form>

      {onToggleJobHistory && (
        <div className="mt-6">
          <button
            onClick={onToggleJobHistory}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showJobHistory ? "Hide Job History" : "Show Job History"}
          </button>
          {showJobHistory && (
            <div className="mt-4">
              <PrintJobHistory
                printerId={printer.id}
                printerType={printer.type}
                apiUrl={printer.apiUrl}
                apiKey={printer.apiKey}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 