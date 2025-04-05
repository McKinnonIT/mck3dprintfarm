"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                      className="h-8 w-8 p-0"
                      title="Move group up"
                    >
                      ↑
                    </Button>
                    <Button
                      onClick={() => moveGroup(group.id, 'down')}
                      size="sm" 
                      variant="outline"
                      className="h-8 w-8 p-0"
                      title="Move group down"
                    >
                      ↓
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {printers
                  .filter(printer => printer.groupId === group.id)
                  .map(printer => (
                    <Card key={printer.id} className="overflow-hidden h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex justify-between items-center">
                          <span>{printer.name}</span>
                          <span className={`text-sm px-2 py-0.5 rounded ${
                            printer.operationalStatus === 'idle' 
                              ? 'bg-green-100 text-green-800' 
                              : printer.operationalStatus === 'printing'
                              ? 'bg-blue-100 text-blue-800'
                              : printer.operationalStatus === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {printer.operationalStatus}
                          </span>
                        </CardTitle>
                        <div className="text-sm text-gray-500">Type: {printer.type}</div>
                        {/* Only show filename for printing printers */}
                        {(printer.operationalStatus === 'printing' && printer.printJobName) ? (
                          <div className="text-sm text-gray-700 mt-1 font-medium truncate" title={printer.printJobName}>
                            File: {printer.printJobName}
                          </div>
                        ) : null}
                      </CardHeader>
                      <CardContent className="flex-grow flex flex-col">
                        {/* Preview Area - Always present */}
                        <div className="mb-4 bg-gray-100 rounded-lg aspect-video w-full flex items-center justify-center overflow-hidden">
                          {printer.printImageUrl ? (
                            <img 
                              src={printer.printImageUrl} 
                              alt={`Preview for ${printer.name}`} 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-gray-400 text-center">
                              {printer.operationalStatus === 'printing' ? 'Print in progress' : 'Ready to print'}
                            </div>
                          )}
                        </div>

                        {/* Printer Details - Always present */}
                        <div className="space-y-3 flex-grow">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Bed:</span>
                            <span className="font-medium">{formatTemperature(printer.bedTemp)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Tool:</span>
                            <span className="font-medium">{formatTemperature(printer.toolTemp)}</span>
                          </div>
                          
                          {/* Job Information Section */}
                          {printer.operationalStatus === 'printing' && (
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Elapsed:</span>
                                <span>{printer.printTimeElapsed ? formatTime(printer.printTimeElapsed) : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Remaining:</span>
                                <span>{printer.printTimeRemaining ? formatTime(printer.printTimeRemaining) : 'N/A'}</span>
                              </div>
                              
                              {/* Progress Bar */}
                              <div className="mt-2">
                                <div className="flex justify-between text-xs mb-1">
                                  <span>Progress</span>
                                  <span>
                                    {calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div 
                                    className="bg-blue-600 h-2.5 rounded-full" 
                                    style={{ width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Empty Space for Idle Printers to maintain height */}
                          {printer.operationalStatus !== 'printing' && (
                            <div className="mt-4 pt-3 border-t border-gray-200 min-h-[120px] flex items-center justify-center">
                              <div className="text-gray-400 text-center">
                                {printer.operationalStatus === 'error'
                                  ? 'Error state'
                                  : 'Ready to print'}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Footer with details link - Always present */}
                        <div className="mt-4 pt-2 border-t border-gray-200 flex justify-end">
                          <Link 
                            href={`/dashboard/printers/${printer.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                          >
                            Details <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-lg text-gray-500 mb-4">
            No active printers available.
          </p>
          <p className="text-sm text-gray-400">
            All printers are either offline or disabled. Check your printer settings.
          </p>
        </div>
      )}
      
      {/* Ungrouped Printers Section */}
      {groups.length > 0 && (
        <div className="space-y-4 mt-10">
          <h2 className="text-xl font-bold">Ungrouped Printers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {printers
              .filter(printer => !printer.groupId || printer.groupId === '')
              .map(printer => (
                <Card key={printer.id} className="overflow-hidden h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center">
                      <span>{printer.name}</span>
                      <span className={`text-sm px-2 py-0.5 rounded ${
                        printer.operationalStatus === 'idle' 
                          ? 'bg-green-100 text-green-800' 
                          : printer.operationalStatus === 'printing'
                          ? 'bg-blue-100 text-blue-800'
                          : printer.operationalStatus === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {printer.operationalStatus}
                      </span>
                    </CardTitle>
                    <div className="text-sm text-gray-500">Type: {printer.type}</div>
                    {/* Only show filename for printing printers */}
                    {(printer.operationalStatus === 'printing' && printer.printJobName) ? (
                      <div className="text-sm text-gray-700 mt-1 font-medium truncate" title={printer.printJobName}>
                        File: {printer.printJobName}
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col">
                    {/* Preview Area - Always present */}
                    <div className="mb-4 bg-gray-100 rounded-lg aspect-video w-full flex items-center justify-center overflow-hidden">
                      {printer.printImageUrl ? (
                        <img 
                          src={printer.printImageUrl} 
                          alt={`Preview for ${printer.name}`} 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-gray-400 text-center">
                          {printer.operationalStatus === 'printing' ? 'Print in progress' : 'Ready to print'}
                        </div>
                      )}
                    </div>

                    {/* Printer Details - Always present */}
                    <div className="space-y-3 flex-grow">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bed:</span>
                        <span className="font-medium">{formatTemperature(printer.bedTemp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tool:</span>
                        <span className="font-medium">{formatTemperature(printer.toolTemp)}</span>
                      </div>
                      
                      {/* Job Information Section */}
                      {printer.operationalStatus === 'printing' && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Elapsed:</span>
                            <span>{printer.printTimeElapsed ? formatTime(printer.printTimeElapsed) : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Remaining:</span>
                            <span>{printer.printTimeRemaining ? formatTime(printer.printTimeRemaining) : 'N/A'}</span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>
                                {calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full" 
                                style={{ width: `${calculateProgress(printer.printTimeElapsed, printer.printTimeRemaining)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Empty Space for Idle Printers to maintain height */}
                      {printer.operationalStatus !== 'printing' && (
                        <div className="mt-4 pt-3 border-t border-gray-200 min-h-[120px] flex items-center justify-center">
                          <div className="text-gray-400 text-center">
                            {printer.operationalStatus === 'error'
                              ? 'Error state'
                              : 'Ready to print'}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Footer with details link - Always present */}
                    <div className="mt-4 pt-2 border-t border-gray-200 flex justify-end">
                      <Link 
                        href={`/dashboard/printers/${printer.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                      >
                        Details <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds) {
  console.log('formatTime input:', seconds, typeof seconds);
  if (seconds === null || seconds === undefined || isNaN(seconds)) return 'N/A';
  
  // Ensure we're working with a number
  seconds = Number(seconds);
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  console.log('formatTime calculated:', { hours, minutes });
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function calculateProgress(elapsed, remaining) {
  console.log('calculateProgress input:', { elapsed, remaining });
  if (elapsed === null || elapsed === undefined || remaining === null || remaining === undefined) return 0;
  
  // Ensure we're working with numbers
  elapsed = Number(elapsed);
  remaining = Number(remaining);
  
  if (isNaN(elapsed) || isNaN(remaining)) return 0;
  
  const total = elapsed + remaining;
  return Math.round((elapsed / total) * 100);
} 