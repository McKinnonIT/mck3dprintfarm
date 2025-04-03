/**
 * Printer interface definition
 */
export interface Printer {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string | null;
  status: string;
  operationalStatus: string;
  // Additional optional properties that might be present from database
  groupId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastSeen?: Date;
  bedTemp?: number;
  targetBedTemp?: number;
  toolTemp?: number;
  targetToolTemp?: number;
  progress?: number;
  printStatus?: string;
  currentFile?: string;
} 