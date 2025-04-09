"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { ChevronRight, RefreshCw, PencilIcon } from "lucide-react";
import { LoadingScreen } from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { PrinterSkeleton } from "@/components/printer-skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "next-auth/react";

// Group type definitions
type Group = {
  id: string;
  name: string;
  description?: string;
  order: number;
  printers: any[];
};

const formatTemperature = (temp) => {
  if (temp === null || temp === undefined) return 'N/A';
  return `${temp}°C`;
};

// Helper to determine background color based on status
const getBgColor = (status) => {
  switch (status) {
    case 'printing': return 'bg-green-100';
    case 'idle': return 'bg-blue-100';
    case 'offline': return 'bg-red-100';
    case 'disabled': return 'bg-gray-100'; // Handle disabled status
    default: return 'bg-yellow-100'; // Fallback for other statuses like 'error'
  }
};

// Helper to determine text color based on status
const getTextColor = (status) => {
  switch (status) {
    case 'printing': return 'text-green-800';
    case 'idle': return 'text-blue-800';
    case 'offline': return 'text-red-800';
    case 'disabled': return 'text-gray-800'; // Handle disabled status
    default: return 'text-yellow-800'; // Fallback for other statuses
  }
};

// Function to calculate progress
const calculateProgress = (elapsed, remaining) => {
  if (!elapsed && !remaining) return 0;
  const total = (elapsed || 0) + (remaining || 0);
  if (total === 0) return 0;
  return (elapsed || 0) / total * 100;
};

// Function to format duration
const formatDuration = (seconds) => {
  if (!seconds) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
};

export default function DashboardPage() {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  // Function to fetch printer status and groups
  const fetchPrinterStatus = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      // Fetch groups first
      const groupsResponse = await fetch('/api/groups');
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        setGroups(groupsData.sort((a: Group, b: Group) => a.order - b.order));
      }
      
      // Fetch printer status
      const response = await fetch('/api/printers/status');
      if (response.ok) {
        const data = await response.json();
        
        // Only show active, online printers
        const activePrinters = data.filter(printer => {
          // Skip disabled printers
          if (printer.status === 'disabled') return false;
          
          // Skip offline printers
          if (printer.operationalStatus === 'offline') return false;
          
          // Ensure the printer has a valid operational status
          if (!printer.operationalStatus) return false;
          
          // Keep all other printers
          return true;
        });
        
        setPrinters(activePrinters);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching printer status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  // Initial fetch
  useEffect(() => {
    fetchPrinterStatus();
  }, []);

  // Set up auto-refresh every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchPrinterStatus();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return '';
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    return `${seconds} seconds ago`;
  };

  if (loading) {
    return <LoadingScreen message="Loading printers" />;
  }

  return (
    <div className="p-6 relative">
      {refreshing && (
        <div className="fixed inset-0 z-40 bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-lg flex flex-col items-center gap-3 max-w-md">
            <Spinner size="md" className="text-blue-600" />
            <h3 className="text-lg font-medium text-gray-800">Updating printer data...</h3>
            <p className="text-sm text-gray-500 text-center">
              Please wait while we collect complete information from all printers.
            </p>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            View and manage your connected 3D printers
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-3">
              Last updated: {lastUpdated ? getTimeSinceUpdate() : 'Never'}
            </span>
            <Button 
              onClick={fetchPrinterStatus} 
              size="sm"
              variant="outline"
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh</span>
                </>
              )}
            </Button>
          </div>
          
          {isAdmin && groups.length > 1 && (
            <div>
              {isEditingGroups ? (
                <div className="flex gap-2">
                  <Button
                    onClick={saveGroupOrder}
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Save Order
                  </Button>
                  <Button
                    onClick={() => setIsEditingGroups(false)}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsEditingGroups(true)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit Groups
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {groups.length > 0 ? (
        // Display printers by groups
        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{group.name}</h2>
                {group.description && (
                  <span className="text-sm text-gray-600">({group.description})</span>
                )}
                
                {isEditingGroups && (
                  <div className="flex gap-1 ml-2">
                    <Button
                      onClick={() => moveGroup(group.id, 'up')}
                      size="sm"
                      variant="outline"
                      className="p-1"
                      title="Move group up"
                    >
                      ↑
                    </Button>
                    <Button
                      onClick={() => moveGroup(group.id, 'down')}
                      size="sm"
                      variant="outline"
                      className="p-1"
                      title="Move group down"
                    >
                      ↓
                    </Button>
                  </div>
                )}
              </div>
              
              {group.printers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.printers.map((printer) => (
                    <Card key={printer.id} className="w-full">
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                          <span className="text-lg">{printer.name}</span>
                          <span 
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getBgColor(printer.operationalStatus)} ${getTextColor(printer.operationalStatus)}`}
                          >
                            {printer.operationalStatus}
                          </span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Type: {printer.type}</p>
                      </CardHeader>
                      <CardContent>
                        {printer.operationalStatus === 'printing' && (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                              <div 
                                className="h-2.5 rounded-full transition-all duration-500 bg-green-600"
                                style={{ width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>Elapsed: {formatDuration(printer.printTimeElapsed)}</span>
                              <span>Remaining: {formatDuration(printer.printTimeRemaining)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between text-sm mt-2">
                          <span>Bed: {formatTemperature(printer.bedTemp)}</span>
                          <span>Tool: {formatTemperature(printer.toolTemp)}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/printers/${printer.id}`}>Details</Link>
                        </Button>
                        {printer.webcamUrl && (
                          <Button variant="outline" size="sm">Webcam</Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No printers in this group</p>
              )}
            </div>
          ))}
          
          {/* Ungrouped printers - display only if groups exist */}
          {groups.length > 0 && (
            <>
              {printers.filter(p => !p.groupId).length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">Ungrouped Printers</h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {printers.filter(p => !p.groupId).map((printer) => (
                      <Card key={printer.id} className="w-full">
                        <CardHeader>
                          <CardTitle className="flex justify-between items-center">
                            <span className="text-lg">{printer.name}</span>
                            <span 
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getBgColor(printer.operationalStatus)} ${getTextColor(printer.operationalStatus)}`}
                            >
                              {printer.operationalStatus}
                            </span>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">Type: {printer.type}</p>
                        </CardHeader>
                        <CardContent>
                          {printer.operationalStatus === 'printing' && (
                            <>
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                <div 
                                  className="h-2.5 rounded-full transition-all duration-500 bg-green-600"
                                  style={{ width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Elapsed: {formatDuration(printer.printTimeElapsed)}</span>
                                <span>Remaining: {formatDuration(printer.printTimeRemaining)}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between text-sm mt-2">
                            <span>Bed: {formatTemperature(printer.bedTemp)}</span>
                            <span>Tool: {formatTemperature(printer.toolTemp)}</span>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/printers/${printer.id}`}>Details</Link>
                          </Button>
                          {printer.webcamUrl && (
                            <Button variant="outline" size="sm">Webcam</Button>
                          )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        // Display if no groups and no ungrouped printers
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            No active printers found. <Link href="/printers/new" className="text-blue-600 hover:underline">Add a printer?</Link>
          </p>
        </div>
      )}
    </div>
  );
} 