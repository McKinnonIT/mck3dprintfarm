"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { WebcamModal } from "@/components/webcam-modal";

type Printer = {
  id: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
  lastSeen: string;
  webcamUrl?: string | null;
  printImageUrl?: string | null;
  bedTemp?: number | null;
  toolTemp?: number | null;
  printStartTime?: string | null;
  printTimeElapsed?: number | null;
  printTimeRemaining?: number | null;
  currentJobFilename?: string | null;
  groupId?: string | null;
};

type Group = {
  id: string;
  name: string;
  description?: string | null;
  order: number;
  printers: Printer[];
};

const REFRESH_INTERVALS = [
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "5m", value: 300000 },
];

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function calculateProgress(elapsed?: number | null, remaining?: number | null): number {
  const total = (elapsed || 0) + (remaining || 0);
  if (total === 0) return 0;
  return ((elapsed || 0) / total) * 100;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "printing":
      return "bg-green-100 text-green-800";
    case "idle":
      return "bg-blue-100 text-blue-800";
    case "offline":
      return "bg-red-100 text-red-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getSnapshotUrl(url: string, timestamp: number): string {
  let snapshotUrl = url;
  if (snapshotUrl.includes("stream")) {
    snapshotUrl = snapshotUrl.replace("stream", "snapshot");
  } else if (snapshotUrl.includes("webcam") && !snapshotUrl.includes("snapshot")) {
    snapshotUrl = snapshotUrl.replace("webcam", "snapshot");
  }
  return `/api/webcam-proxy?url=${encodeURIComponent(snapshotUrl)}&snapshot=true&t=${timestamp}`;
}

function PrinterTile({
  printer,
  timestamp,
  onOpenWebcam,
}: {
  printer: Printer;
  timestamp: number;
  onOpenWebcam: (printer: Printer) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{printer.name}</h3>
          <p className="text-sm text-muted-foreground">{printer.type}</p>
        </div>
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(printer.operationalStatus)}`}>
          {printer.operationalStatus}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {printer.operationalStatus === "printing" ? (
          <>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full bg-green-600 transition-all duration-500"
                style={{ width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%` }}
              />
            </div>
            {printer.currentJobFilename && (
              <p className="text-sm text-muted-foreground truncate">{printer.currentJobFilename}</p>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Elapsed:</span>
              <span>{formatDuration(printer.printTimeElapsed)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span>{formatDuration(printer.printTimeRemaining)}</span>
            </div>
          </>
        ) : (
          <div className="py-2 text-center text-sm text-muted-foreground">
            {printer.operationalStatus === "idle" ? "Ready to print" : printer.operationalStatus === "offline" ? "Offline" : printer.operationalStatus}
          </div>
        )}

        {printer.operationalStatus !== "offline" && (
          <div className="pt-2 border-t mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Bed: {printer.bedTemp != null ? `${printer.bedTemp}°C` : "N/A"}</span>
            <span className="text-muted-foreground">Tool: {printer.toolTemp != null ? `${printer.toolTemp}°C` : "N/A"}</span>
          </div>
        )}
      </div>

      <div className="mt-4 aspect-video relative bg-muted rounded-lg overflow-hidden">
        {printer.webcamUrl ? (
          <div onClick={() => onOpenWebcam(printer)} className="w-full h-full cursor-pointer relative group">
            <img
              src={getSnapshotUrl(printer.webcamUrl, timestamp)}
              alt="Printer Webcam"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).alt = "Webcam unavailable";
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 transition-opacity">
              <span className="text-white px-3 py-1 bg-black bg-opacity-70 rounded-full text-sm">View Livestream</span>
            </div>
          </div>
        ) : printer.printImageUrl ? (
          <img
            src={`/api/webcam-proxy?url=${encodeURIComponent(printer.printImageUrl)}&t=${timestamp}`}
            alt="Print Preview"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder-print.png";
              (e.target as HTMLImageElement).onerror = null;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">No preview available</div>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">Last seen: {new Date(printer.lastSeen).toLocaleString()}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [groups, setGroups] = useState<Group[]>([]);
  const [ungroupedPrinters, setUngroupedPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState<number>(60000);
  const [timestamp, setTimestamp] = useState<number>(0);
  const [activeWebcam, setActiveWebcam] = useState<{ printerName: string; webcamUrl: string } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, statusRes] = await Promise.all([
        fetch("/api/groups"),
        fetch("/api/printers/status"),
      ]);
      if (!groupsRes.ok || !statusRes.ok) throw new Error("Failed to fetch dashboard data");

      const groupsData: Group[] = await groupsRes.json();
      const statusData: Printer[] = await statusRes.json();
      const statusById = new Map(statusData.map((p) => [p.id, p]));

      const visiblePrinters = (list: Printer[]) =>
        list
          .map((p) => statusById.get(p.id) ?? p)
          .filter((p) => p.status !== "disabled" && p.status !== "maintenance");

      const groupedIds = new Set(groupsData.flatMap((g) => g.printers.map((p) => p.id)));

      setGroups(
        groupsData
          .map((g) => ({ ...g, printers: visiblePrinters(g.printers) }))
          .sort((a, b) => a.order - b.order)
      );
      setUngroupedPrinters(visiblePrinters(statusData.filter((p) => !groupedIds.has(p.id))));
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchDashboard, refreshInterval]);

  useEffect(() => {
    setTimestamp(Date.now());
    const webcamTimer = setInterval(() => setTimestamp(Date.now()), 5000);
    return () => clearInterval(webcamTimer);
  }, []);

  const isEmpty = groups.every((g) => g.printers.length === 0) && ungroupedPrinters.length === 0;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Print Farm Dashboard</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted-foreground">Last updated: {lastUpdate.toLocaleTimeString()}</p>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1 bg-background text-foreground"
            >
              {REFRESH_INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  Refresh: {interval.label}
                </option>
              ))}
            </select>
            <button onClick={fetchDashboard} className="text-sm text-blue-600 hover:text-blue-800" disabled={loading}>
              Refresh now
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/printers" className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
              Add Printer
            </Link>
            <Link href="/groups" className="px-3 py-2 bg-muted text-foreground rounded-md text-sm hover:bg-accent">
              Manage Groups
            </Link>
          </div>
        )}
      </div>

      {loading && isEmpty ? (
        <div className="rounded-lg border bg-card p-6 shadow-sm text-center text-muted-foreground">Checking printers...</div>
      ) : isEmpty ? (
        <div className="rounded-lg border bg-card p-6 shadow-sm text-muted-foreground">
          No active printers found.
          {isAdmin && (
            <>
              {" "}
              <Link href="/printers" className="text-blue-600 hover:underline">Add a printer</Link> to get started.
            </>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groups.filter((g) => g.printers.length > 0).map((group) => (
            <div key={group.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{group.name}</h2>
                {group.description && <span className="text-sm text-muted-foreground">({group.description})</span>}
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {group.printers.map((printer) => (
                  <PrinterTile
                    key={printer.id}
                    printer={printer}
                    timestamp={timestamp}
                    onOpenWebcam={(p) => p.webcamUrl && setActiveWebcam({ printerName: p.name, webcamUrl: p.webcamUrl })}
                  />
                ))}
              </div>
            </div>
          ))}

          {ungroupedPrinters.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Ungrouped Printers</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {ungroupedPrinters.map((printer) => (
                  <PrinterTile
                    key={printer.id}
                    printer={printer}
                    timestamp={timestamp}
                    onOpenWebcam={(p) => p.webcamUrl && setActiveWebcam({ printerName: p.name, webcamUrl: p.webcamUrl })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeWebcam && (
        <WebcamModal
          printerName={activeWebcam.printerName}
          webcamUrl={activeWebcam.webcamUrl}
          onClose={() => setActiveWebcam(null)}
        />
      )}
    </div>
  );
}
