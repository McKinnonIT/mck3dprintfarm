"use client";

import React, { useEffect, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { FilamentMaterialSelect, FilamentColorPicker } from "@/components/printers/filament-fields";

type Printer = {
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  serialNumber?: string;
  webcamUrl?: string;
  hlsUrl?: string;
  onvifHost?: string;
  onvifPort?: number;
  onvifUsername?: string;
  onvifPassword?: string;
  status: string;
  groupId?: string;
  machineProfileId?: string;
  filamentMaterial?: string;
  filamentColor?: string;
};

type Group = {
  id: string;
  name: string;
  description?: string;
};

type MachineProfile = {
  id: string;
  name: string;
};

type AddPrinterFormProps = {
  onAdd: (printer: Printer) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function AddPrinterForm({ onAdd, onCancel, isSubmitting }: AddPrinterFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("moonraker");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [webcamUrl, setWebcamUrl] = useState("");
  const [hlsUrl, setHlsUrl] = useState("");
  const [cameraSourceType, setCameraSourceType] = useState<"none" | "bridge" | "onvif">("none");
  const [onvifHost, setOnvifHost] = useState("");
  const [onvifPort, setOnvifPort] = useState("2020");
  const [onvifUsername, setOnvifUsername] = useState("");
  const [onvifPassword, setOnvifPassword] = useState("");
  const [onvifTestState, setOnvifTestState] = useState<
    { status: "idle" } | { status: "testing" } | { status: "success"; streamUri: string; deviceInfo?: { manufacturer?: string; model?: string } } | { status: "error"; message: string }
  >({ status: "idle" });
  const [status, setStatus] = useState("active");
  const [filamentMaterial, setFilamentMaterial] = useState("");
  const [filamentColor, setFilamentColor] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [machineProfileId, setMachineProfileId] = useState("");
  const [machineProfiles, setMachineProfiles] = useState<MachineProfile[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch("/api/groups");
        if (!response.ok) throw new Error("Failed to fetch groups");
        setGroups(await response.json());
      } catch (err) {
        console.error("Failed to fetch groups:", err);
      }
    };
    const fetchMachineProfiles = async () => {
      try {
        const response = await fetch("/api/machine-profiles");
        if (!response.ok) throw new Error("Failed to fetch machine profiles");
        setMachineProfiles(await response.json());
      } catch (err) {
        console.error("Failed to fetch machine profiles:", err);
      }
    };
    fetchGroups();
    fetchMachineProfiles();
  }, []);

  const handleTestOnvif = async () => {
    setOnvifTestState({ status: "testing" });
    try {
      const response = await fetch("/api/cameras/onvif-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: onvifHost,
          port: onvifPort ? Number(onvifPort) : undefined,
          username: onvifUsername,
          password: onvifPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setOnvifTestState({ status: "success", streamUri: data.streamUri, deviceInfo: data.deviceInfo });
      } else {
        setOnvifTestState({ status: "error", message: data.message || "Failed to connect to camera" });
      }
    } catch (err) {
      setOnvifTestState({ status: "error", message: "Failed to reach the server" });
    }
  };

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
      webcamUrl: cameraSourceType === "bridge" ? (webcamUrl || undefined) : undefined,
      hlsUrl: cameraSourceType === "bridge" ? (hlsUrl || undefined) : undefined,
      onvifHost: cameraSourceType === "onvif" ? onvifHost : undefined,
      onvifPort: cameraSourceType === "onvif" && onvifPort ? Number(onvifPort) : undefined,
      onvifUsername: cameraSourceType === "onvif" ? onvifUsername : undefined,
      onvifPassword: cameraSourceType === "onvif" ? onvifPassword : undefined,
      status: "active",
      groupId: groupId || undefined,
      machineProfileId: machineProfileId || undefined,
      filamentMaterial: filamentMaterial || undefined,
      filamentColor: filamentColor || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-foreground">
          Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        >
          <option value="moonraker">Moonraker</option>
          <option value="prusalink">PrusaLink</option>
          <option value="bambulab">Bambu Lab</option>
        </select>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-foreground">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        >
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      <div>
        <label htmlFor="apiUrl" className="block text-sm font-medium text-foreground">
          {type === "bambulab" ? "Printer IP Address" : "API URL"}
        </label>
        <input
          type={type === "bambulab" ? "text" : "url"}
          id="apiUrl"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder={type === "bambulab" ? "192.168.0.123" : "http://printer.local"}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>

      {type === "prusalink" && (
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-foreground">
            API Key
          </label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
      )}

      {type === "bambulab" && (
        <>
          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-foreground">
              Printer Serial Number
            </label>
            <input
              type="text"
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="ABCDEFG123456"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-foreground">
              Access Code
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="000000"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="cameraSourceType" className="block text-sm font-medium text-foreground">
          Camera (optional)
        </label>
        <select
          id="cameraSourceType"
          value={cameraSourceType}
          onChange={(e) => setCameraSourceType(e.target.value as "none" | "bridge" | "onvif")}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="none">No camera</option>
          <option value="onvif">ONVIF Camera (e.g. Tapo)</option>
          <option value="bridge">mediamtx Bridge (HLS URL)</option>
        </select>
      </div>

      {cameraSourceType === "bridge" && (
        <>
          <div>
            <label htmlFor="webcamUrl" className="block text-sm font-medium text-foreground">
              Custom Webcam URL (Optional)
            </label>
            <input
              type="url"
              id="webcamUrl"
              value={webcamUrl}
              onChange={(e) => setWebcamUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="hlsUrl" className="block text-sm font-medium text-foreground">
              HLS Camera URL
            </label>
            <input
              type="text"
              id="hlsUrl"
              value={hlsUrl}
              onChange={(e) => setHlsUrl(e.target.value)}
              placeholder="http://172.22.50.60:8888/camera-name"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Live camera stream from a mediamtx bridge on the camera VLAN. Only the server
              ever connects to this address - it's pulled through the camera-proxy sidecar
              and republished for viewers, so this URL is never sent to their browsers.
            </p>
          </div>
        </>
      )}

      {cameraSourceType === "onvif" && (
        <>
          <div>
            <label htmlFor="onvifHost" className="block text-sm font-medium text-foreground">
              Camera IP Address
            </label>
            <input
              type="text"
              id="onvifHost"
              value={onvifHost}
              onChange={(e) => { setOnvifHost(e.target.value); setOnvifTestState({ status: "idle" }); }}
              placeholder="192.168.1.50"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="onvifPort" className="block text-sm font-medium text-foreground">
              ONVIF Port
            </label>
            <input
              type="text"
              id="onvifPort"
              value={onvifPort}
              onChange={(e) => { setOnvifPort(e.target.value); setOnvifTestState({ status: "idle" }); }}
              placeholder="2020"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">2020 is Tapo's default ONVIF port.</p>
          </div>
          <div>
            <label htmlFor="onvifUsername" className="block text-sm font-medium text-foreground">
              Camera Account Username
            </label>
            <input
              type="text"
              id="onvifUsername"
              value={onvifUsername}
              onChange={(e) => { setOnvifUsername(e.target.value); setOnvifTestState({ status: "idle" }); }}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="onvifPassword" className="block text-sm font-medium text-foreground">
              Camera Account Password
            </label>
            <input
              type="password"
              id="onvifPassword"
              value={onvifPassword}
              onChange={(e) => { setOnvifPassword(e.target.value); setOnvifTestState({ status: "idle" }); }}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tapo cameras need a separate "camera account" set up in the Tapo app
              (Advanced Settings) - not your TP-Link cloud login - used for both ONVIF and RTSP.
            </p>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestOnvif}
              disabled={onvifTestState.status === "testing" || !onvifHost || !onvifUsername || !onvifPassword}
            >
              {onvifTestState.status === "testing" ? "Testing..." : "Test Connection"}
            </Button>
            {onvifTestState.status === "success" && (
              <p className="mt-2 text-xs text-green-600">
                Connected{onvifTestState.deviceInfo?.model ? ` to ${onvifTestState.deviceInfo.manufacturer || ""} ${onvifTestState.deviceInfo.model}`.trim() : ""} -
                stream: {onvifTestState.streamUri.replace(/\/\/[^@]*@/, "//***@")}
              </p>
            )}
            {onvifTestState.status === "error" && (
              <p className="mt-2 text-xs text-red-600">{onvifTestState.message}</p>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="filamentMaterial" className="block text-sm font-medium text-foreground">
            Filament Material (optional)
          </label>
          <FilamentMaterialSelect id="filamentMaterial" value={filamentMaterial} onChange={setFilamentMaterial} />
        </div>
        <div>
          <label htmlFor="filamentColor-hex" className="block text-sm font-medium text-foreground">
            Filament Colour (optional)
          </label>
          <FilamentColorPicker idPrefix="filamentColor" value={filamentColor} onChange={setFilamentColor} />
        </div>
      </div>

      <div>
        <label htmlFor="groupId" className="block text-sm font-medium text-foreground">
          Group (optional)
        </label>
        <select
          id="groupId"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">No Group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="machineProfileId" className="block text-sm font-medium text-foreground">
          Machine Profile (optional)
        </label>
        <select
          id="machineProfileId"
          value={machineProfileId}
          onChange={(e) => setMachineProfileId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">No Profile Assigned</option>
          {machineProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Required to slice files for this printer from the Files page.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full inline-flex items-center justify-center" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : (
          <>
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Printer
          </>
        )}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} className="w-full" disabled={isSubmitting}>
         Cancel
      </Button>
    </form>
  );
} 