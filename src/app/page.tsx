"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowPathIcon, ClockIcon, PencilIcon } from "@heroicons/react/24/outline";
import { WebcamModal } from "@/components/webcam-modal";
import { useSession } from "next-auth/react";

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  status: string; // management status (active/disabled/maintenance)
  operationalStatus: string; // printer status (printing/idle/offline)
  lastSeen: Date;
  printStartTime?: Date;
  printTimeElapsed?: number;
  printTimeRemaining?: number;
  webcamUrl?: string;
  printImageUrl?: string;
  groupId?: string;
  bedTemp?: number;
  toolTemp?: number;
};

type Group = {
  id: string;
  name: string;
  description?: string;
  order: number;
  printers: Printer[];
};

// Define refresh intervals in milliseconds
const REFRESH_INTERVALS = [
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "3m", value: 180000 },
  { label: "4m", value: 240000 },
  { label: "5m", value: 300000 },
  { label: "10m", value: 600000 },
];

export default function HomePage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState<number>(60000); // Default to 1m
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  const [activeWebcam, setActiveWebcam] = useState<{printerId: string, printerName: string, webcamUrl: string} | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ungroupedPrinters, setUngroupedPrinters] = useState<Printer[]>([]);
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const fetchPrinters = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch groups first (which include their printers)
      const groupsResponse = await fetch('/api/groups');
      if (!groupsResponse.ok) throw new Error('Failed to fetch groups');
      const groupsData = await groupsResponse.json();
      setGroups(groupsData.sort((a: Group, b: Group) => a.order - b.order));
      
      // Fetch all printers for status
      const printersResponse = await fetch('/api/printers/status');
      if (!printersResponse.ok) throw new Error('Failed to fetch printers');
      const printersData = await printersResponse.json();
      
      // Debug print times
      printersData.forEach((printer: Printer) => {
        if (printer.type === "prusalink") {
          console.log(`[DEBUG] PrusaLink printer ${printer.name} time data:`, {
            printTimeElapsed: printer.printTimeElapsed,
            printTimeRemaining: printer.printTimeRemaining,
            hasElapsed: !!printer.printTimeElapsed,
            hasRemaining: !!printer.printTimeRemaining
          });
        }
      });
      
      // Identify grouped printer IDs
      const groupedPrinterIds = new Set(
        groupsData.flatMap((group: Group) => 
          group.printers.map((printer: Printer) => printer.id)
        )
      );
      
      // Filter out ungrouped printers
      const ungrouped = printersData.filter(
        (printer: Printer) => !groupedPrinterIds.has(printer.id)
      );
      
      // Update printers with current status
      const printersById = printersData.reduce((acc: Record<string, Printer>, printer: Printer) => {
        acc[printer.id] = printer;
        return acc;
      }, {});
      
      // Update groups with printer status
      const updatedGroups = groupsData.map((group: Group) => ({
        ...group,
        printers: group.printers.map((printer: Printer) => 
          printersById[printer.id] || printer
        )
      }));
      
      setGroups(updatedGroups.sort((a: Group, b: Group) => a.order - b.order));
      setUngroupedPrinters(ungrouped);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to handle saving group order
  const saveGroupOrder = async () => {
    if (!isAdmin) return;
    
    try {
      const updatedGroups = groups.map((group, index) => ({
        id: group.id,
        order: index
      }));
      
      const response = await fetch('/api/groups/order', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedGroups),
      });
      
      if (!response.ok) throw new Error('Failed to update group order');
      
      const data = await response.json();
      setGroups(data);
      setIsEditingGroups(false);
    } catch (error) {
      console.error('Failed to save group order:', error);
    }
  };

  // Function to handle moving a group up or down
  const moveGroup = (groupId: string, direction: 'up' | 'down') => {
    const groupIndex = groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;
    
    const newGroups = [...groups];
    
    if (direction === 'up' && groupIndex > 0) {
      // Swap with the previous group
      [newGroups[groupIndex], newGroups[groupIndex - 1]] = 
      [newGroups[groupIndex - 1], newGroups[groupIndex]];
    } else if (direction === 'down' && groupIndex < groups.length - 1) {
      // Swap with the next group
      [newGroups[groupIndex], newGroups[groupIndex + 1]] = 
      [newGroups[groupIndex + 1], newGroups[groupIndex]];
    }
    
    setGroups(newGroups);
  };

  // Set up auto-refresh
  useEffect(() => {
    fetchPrinters();
    const interval = setInterval(fetchPrinters, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrinters, refreshInterval]);

  // Add webcam refresh timer
  useEffect(() => {
    const webcamTimer = setInterval(() => {
      setTimestamp(Date.now());
    }, 5000); // Refresh webcam images every 5 seconds
    
    return () => clearInterval(webcamTimer);
  }, []);

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return "";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  };

  const calculateProgress = (elapsed?: number, remaining?: number) => {
    if (!elapsed && !remaining) return 0;
    const total = (elapsed || 0) + (remaining || 0);
    if (total === 0) return 0;
    return (elapsed || 0) / total * 100;
  };

  // Helper to convert stream URLs to snapshot URLs
  const getSnapshotUrl = (url: string, timestamp: number) => {
    if (!url) return "";
    
    // Convert stream URLs to snapshot URLs
    let snapshotUrl = url;
    if (snapshotUrl.includes('stream')) {
      snapshotUrl = snapshotUrl.replace('stream', 'snapshot');
    } else if (snapshotUrl.includes('webcam') && !snapshotUrl.includes('snapshot')) {
      snapshotUrl = snapshotUrl.replace('webcam', 'snapshot');
    }
    
    return `/api/webcam-proxy?url=${encodeURIComponent(snapshotUrl)}&snapshot=true&t=${timestamp}`;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Print Farm Dashboard</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-gray-600 flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                Last updated: {formatTime(lastUpdate)}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="text-sm border rounded px-2 py-1 bg-white text-gray-700"
                >
                  {REFRESH_INTERVALS.map((interval) => (
                    <option key={interval.value} value={interval.value}>
                      Refresh: {interval.label}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={fetchPrinters}
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  disabled={loading}
                >
                  <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="ml-1 text-sm">Refresh Now</span>
                </button>
              </div>
            </div>
          </div>
          
          {isAdmin && (
            <div>
              {isEditingGroups ? (
                <div className="flex gap-2">
                  <button
                    onClick={saveGroupOrder}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Save Order
                  </button>
                  <button
                    onClick={() => setIsEditingGroups(false)}
                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingGroups(true)}
                  className="flex items-center px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit Groups
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {loading && printers.length === 0 && groups.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 shadow-sm text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-blue-200 mb-4"></div>
            <div className="h-4 w-60 bg-blue-200 rounded mb-2"></div>
            <p className="text-gray-600 mt-2">Checking Printers...</p>
          </div>
        </div>
      ) : groups.length === 0 && ungroupedPrinters.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-600">
            No active printers found. <Link href="/printers" className="text-blue-600 hover:underline">Add a printer</Link> to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Grouped Printers */}
          {groups.map((group) => (
            <div key={group.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{group.name}</h2>
                {group.description && (
                  <span className="text-sm text-gray-600">({group.description})</span>
                )}
                {isEditingGroups && (
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => moveGroup(group.id, 'up')}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                      title="Move group up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveGroup(group.id, 'down')}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                      title="Move group down"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
              
              {group.printers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {group.printers.map((printer) => (
                    <div
                      key={printer.id}
                      className="rounded-lg border bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">{printer.name}</h2>
                          <p className="text-sm text-gray-600">Type: {printer.type}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            printer.operationalStatus === "printing"
                              ? "bg-green-100 text-green-800"
                              : printer.operationalStatus === "idle"
                              ? "bg-blue-100 text-blue-800"
                              : printer.operationalStatus === "offline"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {printer.operationalStatus}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {printer.operationalStatus === "printing" ? (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="h-2.5 rounded-full transition-all duration-500 bg-green-600"
                                style={{ 
                                  width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%`,
                                }}
                              ></div>
                            </div>
                            
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Time Elapsed:</span>
                              <span>
                                {printer.printTimeElapsed 
                                  ? formatDuration(printer.printTimeElapsed)
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Time Remaining:</span>
                              <span>
                                {printer.printTimeRemaining 
                                  ? formatDuration(printer.printTimeRemaining)
                                  : "N/A"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="py-2 text-center">
                            <span className={`text-sm ${
                              printer.operationalStatus === "idle"
                                ? "text-blue-600"
                                : printer.operationalStatus === "offline"
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}>
                              {printer.operationalStatus === "idle"
                                ? "Ready to print"
                                : printer.operationalStatus === "offline"
                                ? "Offline"
                                : printer.operationalStatus}
                            </span>
                          </div>
                        )}
                        
                        {printer.operationalStatus !== "offline" && (
                          <div className="pt-2 border-t mt-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Bed:</span>
                              <span>{printer.bedTemp ? `${printer.bedTemp}°C` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Tool:</span>
                              <span>{printer.toolTemp ? `${printer.toolTemp}°C` : 'N/A'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 aspect-video relative bg-gray-100 rounded-lg overflow-hidden">
                        {printer.webcamUrl ? (
                          <div 
                            onClick={() => setActiveWebcam({
                              printerId: printer.id,
                              printerName: printer.name,
                              webcamUrl: printer.webcamUrl!
                            })}
                            className="w-full h-full cursor-pointer relative group"
                          >
                            <img
                              src={getSnapshotUrl(printer.webcamUrl, timestamp)}
                              alt="Printer Webcam"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.alt = "Webcam unavailable";
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
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder-print.png";
                              target.onerror = null; // Prevent infinite error loop
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No preview available
                          </div>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-gray-600">
                        Last seen: {new Date(printer.lastSeen).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No printers in this group</p>
              )}
            </div>
          ))}
          
          {/* Ungrouped Printers */}
          {ungroupedPrinters.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Ungrouped Printers</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {ungroupedPrinters.map((printer) => (
                  <div
                    key={printer.id}
                    className="rounded-lg border bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{printer.name}</h2>
                        <p className="text-sm text-gray-600">Type: {printer.type}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          printer.operationalStatus === "printing"
                            ? "bg-green-100 text-green-800"
                            : printer.operationalStatus === "idle"
                            ? "bg-blue-100 text-blue-800"
                            : printer.operationalStatus === "offline"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {printer.operationalStatus}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {printer.operationalStatus === "printing" ? (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="h-2.5 rounded-full transition-all duration-500 bg-green-600"
                              style={{ 
                                width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%`,
                              }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Time Elapsed:</span>
                            <span>
                              {printer.printTimeElapsed 
                                ? formatDuration(printer.printTimeElapsed)
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Time Remaining:</span>
                            <span>
                              {printer.printTimeRemaining 
                                ? formatDuration(printer.printTimeRemaining)
                                : "N/A"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-2 text-center">
                          <span className={`text-sm ${
                            printer.operationalStatus === "idle"
                              ? "text-blue-600"
                              : printer.operationalStatus === "offline"
                              ? "text-red-600"
                              : "text-gray-600"
                          }`}>
                            {printer.operationalStatus === "idle"
                              ? "Ready to print"
                              : printer.operationalStatus === "offline"
                              ? "Offline"
                              : printer.operationalStatus}
                          </span>
                        </div>
                      )}
                      
                      {printer.operationalStatus !== "offline" && (
                        <div className="pt-2 border-t mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Bed:</span>
                            <span>{printer.bedTemp ? `${printer.bedTemp}°C` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tool:</span>
                            <span>{printer.toolTemp ? `${printer.toolTemp}°C` : 'N/A'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 aspect-video relative bg-gray-100 rounded-lg overflow-hidden">
                      {printer.webcamUrl ? (
                        <div 
                          onClick={() => setActiveWebcam({
                            printerId: printer.id,
                            printerName: printer.name,
                            webcamUrl: printer.webcamUrl!
                          })}
                          className="w-full h-full cursor-pointer relative group"
                        >
                          <img
                            src={getSnapshotUrl(printer.webcamUrl, timestamp)}
                            alt="Printer Webcam"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.alt = "Webcam unavailable";
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
                            const target = e.target as HTMLImageElement;
                            target.src = "/placeholder-print.png";
                            target.onerror = null; // Prevent infinite error loop
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No preview available
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      Last seen: {new Date(printer.lastSeen).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Webcam modal - only shown when activeWebcam is set */}
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