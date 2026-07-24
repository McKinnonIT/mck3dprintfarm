"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { PencilIcon, KeyIcon, TrashIcon, PlusIcon, XMarkIcon, CheckIcon, ArrowPathIcon, UserGroupIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DialogDescription } from "@/components/ui/dialog";
import { canAccessPage } from "@/lib/rbacUtils";
import { format, formatDistanceToNow } from 'date-fns';
import { 
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { SlicerSettingsTabs } from "@/components/slicer-settings-tabs";
import { SlicerSettingCategory } from "@/lib/slicer-setting-categories";

type SettingsByCategory = Record<SlicerSettingCategory, Record<string, unknown>>;

interface User {
  id: string;
  email: string;
  name: string | null;
  roleId: string | null;
  roleName: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  allowedPages: string[];
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface RoleDetails extends Role {
  allowedPages: string[];
  allowedActions?: string[];
  users: Pick<User, 'id' | 'name' | 'email'>[];
}

interface RoleFormData {
  name: string;
  description: string;
}

interface UserFormData {
  email: string;
  name: string;
  roleId: string | null;
  password?: string;
}

interface BackupFile {
  filename: string;
  size: number;
  modifiedTime: string; // ISO string
  modifiedTimeFormatted: string; // User-friendly string
}

interface MachineProfile {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  createdAt: string;
  _count: { printers: number };
  // Empty = unrestricted (any Slicing Profile in the library is usable).
  allowedSlicingProfiles: { id: string }[];
  // Only populated by the per-machine detail fetch (openAllowListModal) -
  // the list fetch only exposes a hasBedStl boolean, not the filename.
  bedStlFilename?: string | null;
}

interface FilamentProfile {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  createdAt: string;
}

interface FilamentCandidate {
  name: string;
  filename: string;
  json: string;
}

interface SlicingProfile {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  createdAt: string;
}

interface DatabaseStats {
    dbSize: number;
    userCount: number;
    roleCount: number;
    printerCount: number;
    lastBackupDate: string | null; // ISO string
    lastBackupFilename: string | null;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const AVAILABLE_PAGES = [
  { id: '/dashboard', label: 'Dashboard' },
  { id: '/jobs', label: 'Jobs' },
  { id: '/printers', label: 'Printers' },
  { id: '/groups', label: 'Groups Management' },
  { id: '/files', label: 'Files' },
  { id: '/slicer', label: 'Slicer Integration' },
  { id: '/settings', label: 'Settings (All Tabs)' },
];

// Define available actions for RBAC
const AVAILABLE_ACTIONS = [
  { id: '*'                , label: 'All Actions (Wildcard)' },
  { id: 'roles:create'       , label: 'Create Roles' },
  // { id: 'roles:edit'         , label: 'Edit Roles' }, // Removed
  // { id: 'roles:delete'       , label: 'Delete Roles' }, // Removed
  // { id: 'users:create'       , label: 'Create Users' }, // Removed
  // { id: 'users:edit'         , label: 'Edit Users' }, // Removed
  // { id: 'users:delete'       , label: 'Delete Users' }, // Removed
  // { id: 'users:resetPassword', label: 'Reset User Passwords' }, // Removed
  // { id: 'users:toggleStatus' , label: 'Enable/Disable Users' }, // Removed
  // { id: 'settings:general:edit', label: 'Edit General Settings' }, // Removed
  // { id: 'database:backup:create', label: 'Create Database Backups' }, // Removed
  // { id: 'database:backup:delete', label: 'Delete Database Backups' }, // Removed
  // Granular file printing actions (Currently in use):
  { id: 'files:uploadToPrinter', label: 'Upload Files to Printer (via Modal)' },
  { id: 'files:queuePrint'   , label: 'Queue Print Job (via Modal)' },
  { id: 'files:startPrint'   , label: 'Start Print Job Immediately (via Modal)' },
  // Job management actions:
  { id: 'jobs:create'        , label: 'Submit New Print Job Request' },
  { id: 'jobs:approve'       , label: 'Approve Pending Print Job' },
  { id: 'jobs:reject'        , label: 'Reject Pending Print Job' },
  { id: 'jobs:cancel'        , label: 'Cancel Print Job' },
  { id: 'jobs:view:all'      , label: 'View All Print Jobs' },
  { id: 'jobs:view:own'      , label: 'View Own Print Jobs' },
  // Add more actions as needed
];

const FILE_TYPES = [".stl", ".3mf", ".obj", ".gcode", ".bgcode", ".gx"];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { can } = usePermissions();

  // Extract primitive/stable values for useMemo dependencies
  const userRole = session?.user?.role;
  const userAllowedPagesString = useMemo(() => JSON.stringify(session?.user?.allowedPages || []), [session?.user?.allowedPages]);

  // Stabilize isAdmin and hasAccess using useMemo with primitive/stable dependencies
  const isAdmin = useMemo(() => userRole === 'ADMIN', [userRole]);
  
  const hasAccess = useMemo(() => {
      try {
          const allowedPagesArray = JSON.parse(userAllowedPagesString);
          return canAccessPage(allowedPagesArray, '/settings');
      } catch (e) {
          console.error("Failed to parse allowed pages string:", e);
          return false;
      }
  }, [userAllowedPagesString]);
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDetails | null>(null);
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({ name: "", description: "" });
  const [loadingRoleDetails, setLoadingRoleDetails] = useState(false);
  const [roleDetailsError, setRoleDetailsError] = useState<string | null>(null);
  const [roleActionError, setRoleActionError] = useState<string | null>(null);
  const [isProcessingRole, setIsProcessingRole] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User & { password?: string }>>({});
  const [isProcessingUserAction, setIsProcessingUserAction] = useState(false);

  const [siteSettings, setSiteSettings] = useState({
    printFarmTitle: "",
    organizationName: "",
    organizationWebsite: "",
    allowedUploadTypes: [] as string[],
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  
  const [redirectURIs, setRedirectURIs] = useState({
    google: "",
    microsoftEntra: ""
  });

  const [isProcessingUserToggle, setIsProcessingUserToggle] = useState(false);

  const [editingRole, setEditingRole] = useState<RoleDetails | null>(null);
  const [newRoleData, setNewRoleData] = useState({ name: '', description: '', allowedPages: [] as string[], allowedActions: [] as string[] });

  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);

  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [machineProfiles, setMachineProfiles] = useState<MachineProfile[]>([]);
  const [filamentProfiles, setFilamentProfiles] = useState<FilamentProfile[]>([]);
  const [slicingProfiles, setSlicingProfiles] = useState<SlicingProfile[]>([]);
  const [loadingSlicerProfiles, setLoadingSlicerProfiles] = useState(true);
  const [slicerProfilesError, setSlicerProfilesError] = useState<string | null>(null);
  const [isImportBundleModalOpen, setIsImportBundleModalOpen] = useState(false);
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [isImportingBundle, setIsImportingBundle] = useState(false);
  const [importBundleError, setImportBundleError] = useState<string | null>(null);

  // Post-import "which filaments to keep" modal
  const [isFilamentSelectionModalOpen, setIsFilamentSelectionModalOpen] = useState(false);
  const [filamentCandidates, setFilamentCandidates] = useState<FilamentCandidate[]>([]);
  const [selectedFilamentNames, setSelectedFilamentNames] = useState<Set<string>>(new Set());
  const [isImportingFilaments, setIsImportingFilaments] = useState(false);
  const [importFilamentsError, setImportFilamentsError] = useState<string | null>(null);

  // Per-machine "Printer Settings" modal - slicing-profile allow-list plus
  // the bed STL upload (purely visual, see MachineProfile.bedStlPath).
  const [managingAllowListFor, setManagingAllowListFor] = useState<MachineProfile | null>(null);
  const [allowListSelectedIds, setAllowListSelectedIds] = useState<Set<string>>(new Set());
  const [isSavingAllowList, setIsSavingAllowList] = useState(false);
  const [allowListError, setAllowListError] = useState<string | null>(null);
  const [isSavingBedStl, setIsSavingBedStl] = useState(false);
  const [bedStlError, setBedStlError] = useState<string | null>(null);

  // "Create Slicing Profile" modal (clone an existing profile + edit curated fields)
  const [isCreateProfileModalOpen, setIsCreateProfileModalOpen] = useState(false);
  const [newProfileBaseId, setNewProfileBaseId] = useState("");
  const [newProfileMachineId, setNewProfileMachineId] = useState("");
  const [newProfileFilamentId, setNewProfileFilamentId] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");
  const [newProfileValues, setNewProfileValues] = useState<SettingsByCategory | null>(null);
  const [isPreviewingProfile, setIsPreviewingProfile] = useState(false);
  const [previewProfileError, setPreviewProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [createProfileError, setCreateProfileError] = useState<string | null>(null);

  // Add state for conditional rendering
  const [isReady, setIsReady] = useState(false);

  // --- Ref for Run-Once Logic ---
  const hasFetchedData = useRef(false);

  // --- useEffects for Auth/Access Check (Redirecting) ---
  useEffect(() => {
    if (status === 'loading') return; // Don't do anything while loading
    if (status === 'unauthenticated') {
        console.log("SettingsPage: Unauthenticated, redirecting to signin...");
        if (!isReady) setIsReady(true); // Set ready before redirecting
        router.replace('/auth/signin');
    } else if (status === 'authenticated' && !hasAccess) {
        console.log("SettingsPage: Access denied, redirecting to /access-denied...");
        if (!isReady) setIsReady(true); // Set ready before redirecting
        router.replace('/access-denied');
    }
    // If authenticated and has access, this effect does nothing, 
    // the other effect handles setting ready after fetch.
  }, [status, hasAccess, router, isReady]); // Add isReady to dependencies

  // --- Fetching Functions (Memoized with useCallback) ---
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    console.log("Fetching users...");
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const response = await fetch("/api/users");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error("Error in fetchUsers:", err);
      setUsersError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  const fetchRoles = useCallback(async () => {
    if (!isAdmin) return;
    console.log("Fetching roles...");
    setLoadingRoles(true);
    setRolesError(null);
    try {
      const response = await fetch("/api/roles");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch roles");
      }
      const data: Role[] = await response.json();
      setRoles(data.map(role => ({ ...role, allowedPages: role.allowedPages || [] })));
    } catch (err) {
      console.error("Error fetching roles:", err);
      setRolesError(err instanceof Error ? err.message : "An error occurred fetching roles");
    } finally {
      setLoadingRoles(false);
    }
  }, [isAdmin]);

  const fetchSettings = useCallback(async () => {
    console.log("Fetching settings...");
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch settings");
      }
      const data = await response.json();
      setSiteSettings({
        printFarmTitle: data.printFarmTitle || "",
        organizationName: data.organizationName || "",
        organizationWebsite: data.organizationWebsite || "",
        allowedUploadTypes: Array.isArray(data.allowedUploadTypes) ? data.allowedUploadTypes : [],
      });
      setSettingsError(null);
    } catch (err) {
      console.error("Error in fetchSettings:", err);
      setSettingsError(err instanceof Error ? err.message : "An error occurred");
      setSiteSettings(prev => ({ ...prev, allowedUploadTypes: [] }));
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    if (!isAdmin) return;
    console.log("Fetching database backups...");
    setIsLoadingBackups(true);
    setBackupsError(null);
    try {
      const response = await fetch('/api/database/backups');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const data = await response.json();
      setBackupFiles(data.backups || []);
      console.log("Fetched backups:", data.backups);
    } catch (err: any) {
      console.error("Failed to fetch backups:", err);
      setBackupsError(err.message || 'Could not load backups.');
      setBackupFiles([]);
    } finally {
      setIsLoadingBackups(false);
    }
  }, [isAdmin]);

  const fetchDbStats = useCallback(async () => {
    if (!isAdmin) return;
    console.log("Fetching database stats...");
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const response = await fetch('/api/database/stats');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const data: DatabaseStats = await response.json();
      setDbStats(data);
      console.log("Fetched DB stats:", data);
    } catch (err: any) {
      console.error("Failed to fetch DB stats:", err);
      setStatsError(err.message || 'Could not load database statistics.');
      setDbStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [isAdmin]);

  const fetchSlicerProfiles = useCallback(async () => {
    if (!isAdmin) return;
    console.log("Fetching slicer profile libraries...");
    setLoadingSlicerProfiles(true);
    setSlicerProfilesError(null);
    try {
      const [machineRes, filamentRes, slicingRes] = await Promise.all([
        fetch("/api/machine-profiles"),
        fetch("/api/filament-profiles"),
        fetch("/api/slicing-profiles"),
      ]);
      if (!machineRes.ok) throw new Error("Failed to fetch machine profiles");
      if (!filamentRes.ok) throw new Error("Failed to fetch filament profiles");
      if (!slicingRes.ok) throw new Error("Failed to fetch slicing profiles");
      setMachineProfiles(await machineRes.json());
      setFilamentProfiles(await filamentRes.json());
      setSlicingProfiles(await slicingRes.json());
    } catch (err) {
      console.error("Error in fetchSlicerProfiles:", err);
      setSlicerProfilesError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoadingSlicerProfiles(false);
    }
  }, [isAdmin]);

  // --- useEffect for Initial Data Fetching (Using useRef Flag, minimal deps) ---
  useEffect(() => {
    if (status === 'authenticated') {
        if (!hasFetchedData.current) {
            console.log(`SettingsPage: Authenticated & first run check. Evaluating access...`);
            const currentAllowedPages = session?.user?.allowedPages;
            const currentHasAccess = canAccessPage(currentAllowedPages, '/settings');
            const currentIsAdmin = session?.user?.role === 'ADMIN';
            console.log(`Current Access: ${currentHasAccess}, Current Admin: ${currentIsAdmin}`);

            if (currentHasAccess) {
                console.log("SettingsPage: Access confirmed. Performing initial data fetch...");
                fetchSettings(); 
                if (currentIsAdmin) {
                    console.log("SettingsPage: User is Admin. Fetching admin-specific data...");
                    fetchUsers();
                    fetchRoles();
                    fetchBackups();
                    fetchDbStats();
                    fetchSlicerProfiles();
                }
                hasFetchedData.current = true; 
                if (!isReady) setIsReady(true); // Set ready after fetch completes
                console.log("SettingsPage: Initial fetch marked as complete, isReady=true.");
            } else {
                 console.log("SettingsPage: Authenticated but access denied. Skipping initial fetch.");
                 hasFetchedData.current = true;
                 if (!isReady) setIsReady(true); // Set ready even if denied access
                 console.log("SettingsPage: Initial fetch attempt marked as complete (access denied), isReady=true.");
            }
        } else {
             console.log("SettingsPage: Authenticated, but initial fetch already completed.");
             if (!isReady) setIsReady(true); 
        }
    } else if (status === 'unauthenticated') {
        if (!isReady) setIsReady(true); 
         console.log("SettingsPage: Status changed to unauthenticated, ensuring isReady=true for redirect.");
    }
  }, [status, isReady]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectURIs({
        google: `${window.location.origin}/api/auth/callback/google`,
        microsoftEntra: `${window.location.origin}/api/auth/callback/azure-ad`
      });
    }
  }, []);

  const fetchRoleDetails = async (roleId: string): Promise<RoleDetails | null> => {
    console.log(`Fetching details for role ${roleId}...`);
    setLoadingRoleDetails(true);
    setRoleDetailsError(null);
    try {
      const response = await fetch(`/api/roles/${roleId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch details for role ${roleId}`);
      }
      const data: RoleDetails = await response.json();
      return data;
    } catch (err) {
      console.error(`Error fetching role details for ${roleId}:`, err);
      setRoleDetailsError(err instanceof Error ? err.message : `An error occurred fetching details for role ${roleId}`);
      return null;
    } finally {
      setLoadingRoleDetails(false);
    }
  };

  const handleRoleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRoleFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddRoleModal = () => {
    // Reset form data including allowedActions
    setNewRoleData({ name: '', description: '', allowedPages: [], allowedActions: [] });
    setRoleActionError(null);
    setIsAddRoleModalOpen(true);
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting new role:", newRoleData);
    setIsProcessingRole(true);
    setRoleActionError(null);
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
             name: newRoleData.name, 
             description: newRoleData.description, 
             allowedPages: newRoleData.allowedPages,
             allowedActions: newRoleData.allowedActions // Include allowedActions
        }), 
      });
      const result = await response.json();
      setRoles(prev => [...prev, { ...result, allowedPages: result.allowedPages || [] }]);
      closeAddRoleModal();
    } catch (err) {
      console.error("Add Role Error:", err);
      setRoleActionError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessingRole(false);
    }
  };

  const closeAddRoleModal = () => {
    setIsAddRoleModalOpen(false);
    setNewRoleData({ name: '', description: '', allowedPages: [], allowedActions: [] });
  };

  const openEditRoleModal = (role: Role) => {
    console.log("Opening edit modal for role:", role);
    // Ensure allowedActions is an array when setting editingRole state
    setEditingRole({ 
        ...role, 
        allowedPages: Array.isArray(role.allowedPages) ? role.allowedPages : [],
        allowedActions: Array.isArray((role as any).allowedActions) ? (role as any).allowedActions : [] 
    } as RoleDetails);
    setRoleActionError(null);
    setIsEditRoleModalOpen(true);
  };

  const closeEditRoleModal = () => {
    setIsEditRoleModalOpen(false);
    setEditingRole(null);
  };

  const handleAllowedPageChange = (pageId: string, checked: boolean | string, isEditing: boolean) => {
    const currentAllowedPages = isEditing ? (editingRole?.allowedPages || []) : newRoleData.allowedPages;
    let updatedPages;
    if (checked) {
      updatedPages = [...currentAllowedPages, pageId];
    } else {
      updatedPages = currentAllowedPages.filter(id => id !== pageId);
    }
    
    if (isEditing) {
      setEditingRole(prev => prev ? { ...prev, allowedPages: updatedPages } : null);
    } else {
      setNewRoleData(prev => ({ ...prev, allowedPages: updatedPages }));
    }
  };

  const handleAllowedActionChange = (actionId: string, checked: boolean | string, isEditing: boolean) => {
    const calculateUpdatedActions = (currentActions: string[] | undefined): string[] => {
        let updated = [...(currentActions || [])];
        if (checked) {
            if (!updated.includes(actionId)) {
                updated.push(actionId);
            }
            if (actionId === '*') {
                updated = ['*'];
            } else if (updated.includes('*')) {
                updated = updated.filter(a => a !== '*');
            }
        } else {
            updated = updated.filter(a => a !== actionId);
        }
        return updated;
    };

    if (isEditing) {
        if (!editingRole) return;
        const updatedActions = calculateUpdatedActions(editingRole.allowedActions);
        setEditingRole(prev => prev ? { ...prev, allowedActions: updatedActions } : null);
    } else {
        const updatedActions = calculateUpdatedActions(newRoleData.allowedActions);
        setNewRoleData(prev => ({ ...prev, allowedActions: updatedActions }));
    }
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    console.log("Submitting edited role:", editingRole);
    setIsProcessingRole(true);
    setRoleActionError(null);
    try {
      const response = await fetch(`/api/roles/${editingRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: editingRole.name, 
            description: editingRole.description, 
            allowedPages: editingRole.allowedPages,
            allowedActions: editingRole.allowedActions // Include allowedActions
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }
      const updatedRole: Role = await response.json();
      setRoles(prev => prev.map(r => r.id === updatedRole.id ? { ...updatedRole, allowedPages: updatedRole.allowedPages || [] } : r));
      closeEditRoleModal();
    } catch (err) {
      console.error("Edit Role Error:", err);
      setRoleActionError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessingRole(false);
    }
  };

  const openDeleteRoleDialog = (role: Role) => {
    setRoleToDelete(role);
    setRolesError(null);
    setIsDeleteRoleDialogOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setIsProcessingRole(true);
    setRolesError(null);
    try {
      const response = await fetch(`/api/roles/${roleToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete role');
      }
      setRoles(prev => prev.filter(r => r.id !== roleToDelete.id));
      setIsDeleteRoleDialogOpen(false);
      setRoleToDelete(null);
    } catch (err) {
      console.error("Delete Role Error:", err);
      setRolesError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessingRole(false);
    }
  };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSiteSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAllowedTypeChange = (fileType: string, checked: boolean | string) => {
    setSiteSettings(prev => {
        const currentTypes = prev.allowedUploadTypes;
        let updatedTypes;
        if (checked) {
            updatedTypes = [...currentTypes, fileType];
        } else {
            updatedTypes = currentTypes.filter(type => type !== fileType);
        }
        // Ensure uniqueness and sort for consistency (optional)
        updatedTypes = Array.from(new Set(updatedTypes)).sort();
        return { ...prev, allowedUploadTypes: updatedTypes };
    });
  };

  const saveSettings = async () => {
    try {
      setIsSavingSettings(true);
      setSettingsError(null);
      setSettingsSaved(false);
      
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printFarmTitle: siteSettings.printFarmTitle,
          organizationName: siteSettings.organizationName,
          organizationWebsite: siteSettings.organizationWebsite,
          allowedUploadTypes: siteSettings.allowedUploadTypes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      setSettingsSaved(true);
      fetchSettings(); 
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error("Error in saveSettings:", err);
      setSettingsError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleUserEnabled = async (user: User, checked: boolean) => {
    console.log(`Toggling user ${user.id} to ${checked}`);
    setIsProcessingUserToggle(true);
    setUsersError(null);

    const originalUsers = [...users];
    setUsers(prevUsers => 
        prevUsers.map(u => 
            u.id === user.id ? { ...u, isEnabled: checked } : u
        )
    );

    try {
        if (session?.user?.id === user.id && !checked) {
            throw new Error("You cannot disable your own account.");
        }
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
        if (user.email === adminEmail && !checked) {
             throw new Error("You cannot disable the default administrator account.");
        }

        const response = await fetch(`/api/users/${user.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isEnabled: checked }),
        });
      
      if (!response.ok) {
        const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update user status");
      }
    } catch (err) {
        console.error("Toggle User Status Error:", err);
        setUsersError(err instanceof Error ? err.message : "An error occurred");
        setUsers(originalUsers);
    } finally {
        setIsProcessingUserToggle(false);
    }
  };

  const handleAddUser = async () => {
    setIsProcessingUserAction(true);
    setUsersError(null);
    try {
      if (!formData.roleId) {
          throw new Error("Please select a role for the new user.");
      }
      const response = await fetch("/api/users", {
        method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData) 
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }
      const newUser = await response.json();
      setUsers([newUser, ...users]);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Add User Error:", err);
      setUsersError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessingUserAction(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setIsProcessingUserAction(true);
    setUsersError(null);
    try {
       if (!formData.roleId) {
          throw new Error("Please select a role for the user.");
      }
      const updateData = {
          name: formData.name,
          email: formData.email,
          roleId: formData.roleId,
      };

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }
      const updatedUser = await response.json();
      setUsers(users.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      ));
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Edit User Error:", err);
      setUsersError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessingUserAction(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !formData.password) return;
    setIsProcessingUserAction(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: formData.password }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reset password");
      }
      setIsResetPasswordModalOpen(false);
      setSelectedUser(null);
      setFormData({ email: "", name: "", roleId: null, password: "" }); 
    } catch (err) {
      console.error("Error in handleResetPassword:", err);
    } finally {
      setIsProcessingUserAction(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete user");
      }
      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      console.error("Error in handleDeleteUser:", err);
      setUsersError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const openAddModal = () => {
    setSelectedUser(null);
    setFormData({ email: "", name: "", roleId: null, password: "" }); 
    setIsAddModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name || "",
      roleId: user.roleId, 
    });
    setIsEditModalOpen(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setFormData({ email: user.email, name: user.name || "", roleId: user.roleId, password: "" }); 
    setIsResetPasswordModalOpen(true);
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupStatusMessage(null);
    setBackupError(null);
    console.log("Initiating database backup...");
    
    try {
        const response = await fetch('/api/database/backup', {
            method: 'POST',
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `API Error: ${response.status}`);
        }
        
        console.log("Backup successful:", result.message);
        setBackupStatusMessage(result.message || 'Backup created successfully.');
        fetchBackups();
        
    } catch (err: any) {
        console.error("Backup failed:", err);
        setBackupError(err.message || 'An unexpected error occurred during backup.');
        setBackupStatusMessage(null);
    } finally {
        setIsCreatingBackup(false);
        setTimeout(() => {
           setBackupStatusMessage(null);
           setBackupError(null);
        }, 5000); 
    }
  };

  // State for Delete Confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
  const [isDeletingBackup, setIsDeletingBackup] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Function to open delete confirmation dialog
  const openDeleteDialog = (filename: string) => {
    setBackupToDelete(filename);
    setDeleteError(null); // Clear previous errors
    setIsDeleteDialogOpen(true);
  };

  // Function to handle the actual deletion
  const handleDeleteBackup = async () => {
    if (!backupToDelete) return;
    
    console.log(`Attempting to delete backup: ${backupToDelete}`);
    setIsDeletingBackup(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/database/backups/${encodeURIComponent(backupToDelete)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete backup (Status: ${response.status})`);
      }

      // Remove deleted backup from state
      setBackupFiles(prev => prev.filter(b => b.filename !== backupToDelete));
      console.log(`Backup ${backupToDelete} deleted successfully.`);
      setIsDeleteDialogOpen(false); // Close dialog on success
      setBackupToDelete(null);

    } catch (err: any) {
      console.error("Delete Backup Error:", err);
      setDeleteError(err.message || "An unexpected error occurred.");
      // Keep dialog open on error to show message?
      // setIsDeleteDialogOpen(false); 
      // setBackupToDelete(null);
    } finally {
      setIsDeletingBackup(false);
    }
  };

  const openImportBundleModal = () => {
    setBundleFile(null);
    setImportBundleError(null);
    setIsImportBundleModalOpen(true);
  };

  const handleImportBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleFile) {
      setImportBundleError("A .orca_printer bundle file is required.");
      return;
    }
    setIsImportingBundle(true);
    setImportBundleError(null);
    try {
      const formData = new FormData();
      formData.append("bundle", bundleFile);

      const response = await fetch("/api/slicer-profiles/import", { method: "POST", body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import bundle");
      }
      const result = await response.json();
      toast.success(
        `Imported ${result.machineProfiles.length} machine and ${result.slicingProfiles.length} slicing profile(s).`
      );
      setIsImportBundleModalOpen(false);
      fetchSlicerProfiles();

      // Filaments aren't auto-imported - hand off to the selection modal if
      // the bundle actually contained any.
      if (result.filamentCandidates?.length > 0) {
        setFilamentCandidates(result.filamentCandidates);
        setSelectedFilamentNames(new Set(result.filamentCandidates.map((f: FilamentCandidate) => f.name)));
        setImportFilamentsError(null);
        setIsFilamentSelectionModalOpen(true);
      }
    } catch (err) {
      setImportBundleError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsImportingBundle(false);
    }
  };

  const toggleFilamentCandidate = (name: string, checked: boolean) => {
    setSelectedFilamentNames((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const handleConfirmFilamentImport = async () => {
    const selected = filamentCandidates.filter((f) => selectedFilamentNames.has(f.name));
    if (selected.length === 0) {
      setIsFilamentSelectionModalOpen(false);
      return;
    }
    setIsImportingFilaments(true);
    setImportFilamentsError(null);
    try {
      const response = await fetch("/api/slicer-profiles/import/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filaments: selected }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import filaments");
      }
      const result = await response.json();
      toast.success(`Imported ${result.filamentProfiles.length} filament profile(s).`);
      setIsFilamentSelectionModalOpen(false);
      fetchSlicerProfiles();
    } catch (err) {
      setImportFilamentsError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsImportingFilaments(false);
    }
  };

  const handleDeleteMachineProfile = async (profile: MachineProfile) => {
    if (!window.confirm(`Delete machine profile "${profile.name}"?`)) return;
    setSlicerProfilesError(null);
    try {
      const response = await fetch(`/api/machine-profiles/${profile.id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete machine profile");
      }
      setMachineProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (err) {
      setSlicerProfilesError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteFilamentProfile = async (profile: FilamentProfile) => {
    if (!window.confirm(`Delete filament profile "${profile.name}"?`)) return;
    setSlicerProfilesError(null);
    try {
      const response = await fetch(`/api/filament-profiles/${profile.id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete filament profile");
      }
      setFilamentProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (err) {
      setSlicerProfilesError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteSlicingProfile = async (profile: SlicingProfile) => {
    if (!window.confirm(`Delete slicing profile "${profile.name}"?`)) return;
    setSlicerProfilesError(null);
    try {
      const response = await fetch(`/api/slicing-profiles/${profile.id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete slicing profile");
      }
      setSlicingProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (err) {
      setSlicerProfilesError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const openAllowListModal = async (profile: MachineProfile) => {
    setManagingAllowListFor(profile);
    setAllowListError(null);
    setBedStlError(null);
    try {
      const response = await fetch(`/api/machine-profiles/${profile.id}`);
      if (!response.ok) throw new Error("Failed to fetch machine profile detail");
      const detail = await response.json();
      setAllowListSelectedIds(new Set(detail.allowedSlicingProfiles.map((p: { id: string }) => p.id)));
      setManagingAllowListFor((prev) => (prev ? { ...prev, bedStlFilename: detail.bedStlFilename } : prev));
    } catch (err) {
      setAllowListError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleUploadBedStl = async (file: File) => {
    if (!managingAllowListFor) return;
    setIsSavingBedStl(true);
    setBedStlError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/machine-profiles/${managingAllowListFor.id}/bed-stl`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload bed STL");
      }
      const result = await response.json();
      setManagingAllowListFor((prev) => (prev ? { ...prev, bedStlFilename: result.bedStlFilename } : prev));
      toast.success("Bed STL uploaded.");
    } catch (err) {
      setBedStlError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingBedStl(false);
    }
  };

  const handleRemoveBedStl = async () => {
    if (!managingAllowListFor) return;
    setIsSavingBedStl(true);
    setBedStlError(null);
    try {
      const response = await fetch(`/api/machine-profiles/${managingAllowListFor.id}/bed-stl`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove bed STL");
      }
      setManagingAllowListFor((prev) => (prev ? { ...prev, bedStlFilename: null } : prev));
      toast.success("Bed STL removed.");
    } catch (err) {
      setBedStlError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingBedStl(false);
    }
  };

  const toggleAllowListProfile = (id: string, checked: boolean) => {
    setAllowListSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSaveAllowList = async () => {
    if (!managingAllowListFor) return;
    setIsSavingAllowList(true);
    setAllowListError(null);
    try {
      const response = await fetch(`/api/machine-profiles/${managingAllowListFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedSlicingProfileIds: Array.from(allowListSelectedIds) }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save allow-list");
      }
      toast.success(`Updated allowed slicing profiles for "${managingAllowListFor.name}".`);
      setManagingAllowListFor(null);
      fetchSlicerProfiles();
    } catch (err) {
      setAllowListError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingAllowList(false);
    }
  };

  const openCreateProfileModal = () => {
    setNewProfileBaseId("");
    setNewProfileMachineId("");
    setNewProfileFilamentId("");
    setNewProfileName("");
    setNewProfileDescription("");
    setNewProfileValues(null);
    setPreviewProfileError(null);
    setCreateProfileError(null);
    setIsCreateProfileModalOpen(true);
  };

  // Re-preview whenever the base/machine/filament selection is complete.
  useEffect(() => {
    if (!isCreateProfileModalOpen || !newProfileBaseId || !newProfileMachineId || !newProfileFilamentId) {
      return;
    }
    let cancelled = false;
    setIsPreviewingProfile(true);
    setPreviewProfileError(null);
    (async () => {
      try {
        const response = await fetch("/api/slicing-profiles/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseSlicingProfileId: newProfileBaseId,
            machineProfileId: newProfileMachineId,
            filamentProfileId: newProfileFilamentId,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to preview settings");
        if (cancelled) return;
        setNewProfileValues(data.categories);
      } catch (err) {
        if (!cancelled) setPreviewProfileError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (!cancelled) setIsPreviewingProfile(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isCreateProfileModalOpen, newProfileBaseId, newProfileMachineId, newProfileFilamentId]);

  const handleNewProfileFieldChange = (category: SlicerSettingCategory, field: string, value: string) => {
    setNewProfileValues((prev) => ({
      Quality: {}, Strength: {}, Supports: {}, Other: {},
      ...prev,
      [category]: { ...(prev?.[category] || {}), [field]: value },
    }));
  };

  const handleCreateProfile = async () => {
    if (!newProfileBaseId || !newProfileName || !newProfileValues) return;
    setIsSavingProfile(true);
    setCreateProfileError(null);
    try {
      const response = await fetch("/api/slicing-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseSlicingProfileId: newProfileBaseId,
          name: newProfileName,
          description: newProfileDescription || undefined,
          overrides: newProfileValues,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create slicing profile");
      }
      toast.success(`Created slicing profile "${newProfileName}".`);
      setIsCreateProfileModalOpen(false);
      fetchSlicerProfiles();
    } catch (err) {
      setCreateProfileError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Conditional Rendering Logic ---
  if (!isReady) {
     console.log("SettingsPage: Rendering loading state (isReady=false).");
  return (
        <div className="flex justify-center items-center min-h-screen">
          <p>Loading Settings...</p> {/* Or a more sophisticated spinner */}
              </div>
      );
  }

  // --- Main Component Return (Only when isReady is true) ---
  console.log("SettingsPage: Rendering main content (isReady=true).");
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-7' : 'grid-cols-3'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          {isAdmin && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {isAdmin && <TabsTrigger value="slicerProfiles">Slicer Profiles</TabsTrigger>}
          <TabsTrigger value="sso">SSO</TabsTrigger>
          {isAdmin && <TabsTrigger value="database">Database</TabsTrigger>}
          <TabsTrigger value="updates">Updates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Site Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsError && <p className="text-red-600">Error: {settingsError}</p>}
              <div className="space-y-2">
                <label htmlFor="printFarmTitle" className="block text-sm font-medium">Print Farm Title</label>
                <Input id="printFarmTitle" name="printFarmTitle" value={siteSettings.printFarmTitle} onChange={handleSettingsChange} disabled={isSavingSettings} />
              </div>
              <div className="space-y-2">
                <label htmlFor="organizationName" className="block text-sm font-medium">Organization Name</label>
                <Input id="organizationName" name="organizationName" value={siteSettings.organizationName} onChange={handleSettingsChange} disabled={isSavingSettings} />
                </div>
              <div className="space-y-2">
                <label htmlFor="organizationWebsite" className="block text-sm font-medium">Organization Website</label>
                <Input id="organizationWebsite" name="organizationWebsite" value={siteSettings.organizationWebsite} onChange={handleSettingsChange} disabled={isSavingSettings} />
                </div>
              <div className="space-y-2 border-t pt-4">
                <Label>Allowed Upload File Types</Label>
                <p className="text-sm text-muted-foreground">
                  Select which file extensions users are allowed to upload via the Files page.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
                  {FILE_TYPES.map((fileType) => (
                    <div key={fileType} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${fileType}`}
                        checked={siteSettings.allowedUploadTypes.includes(fileType)}
                        onCheckedChange={(checked) => handleAllowedTypeChange(fileType, checked)}
                        disabled={isSavingSettings}
                      />
                      <Label htmlFor={`type-${fileType}`} className="font-mono font-normal">
                        {fileType}
                      </Label>
                    </div>
                  ))}
                    </div>
                  </div>
              <div className="flex justify-end pt-4 border-t">
                 {settingsSaved && <p className="text-green-600 mr-4 self-center">Settings saved!</p>} 
                <Button onClick={saveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Settings"}
                </Button>
                    </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Management</CardTitle>
                <Button onClick={openAddModal}><PlusIcon className="h-4 w-4 mr-2" /> Add User</Button>
            </CardHeader>
            <CardContent>
                {loadingUsers && <p>Loading users...</p>}
                {usersError && <p className="text-red-600">Error: {usersError}</p>}
                {!loadingUsers && !usersError && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead> 
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className={!user.isEnabled ? "opacity-50" : ""}>
                          <TableCell>
                            <Switch
                              checked={user.isEnabled}
                              onCheckedChange={(checked) => handleToggleUserEnabled(user, checked)}
                              disabled={isProcessingUserToggle || session?.user?.id === user.id || user.email === (process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com')}
                              aria-label={user.isEnabled ? "Disable user" : "Enable user"}
                            />
                          </TableCell>
                          <TableCell>{user.name || "N/A"}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.roleName}</TableCell> 
                          <TableCell className="space-x-2">
                            <Button variant="outline" size="sm" onClick={() => openEditModal(user)} title="Edit User">
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openResetPasswordModal(user)} title="Reset Password">
                              <KeyIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline"
                              className="text-red-600 hover:text-red-700" 
                              size="sm" 
                                      onClick={() => handleDeleteUser(user.id)}
                              title="Delete User">
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Manage Roles</CardTitle>
                    <CardDescription>Define roles and their page access permissions.</CardDescription>
                  </div>
                  {can('roles:create') && (
                    <Button onClick={openAddRoleModal} variant="outline" size="sm">
                      <PlusIcon className="h-4 w-4 mr-1" /> Create Role
                    </Button>
                  )}
                  </div>
              </CardHeader>
              <CardContent>
                {rolesError && (
                    <div className="mb-4 text-sm text-red-600 bg-red-100 border border-red-300 rounded p-3">
                        Error: {rolesError}
                </div>
                )}
                {!loadingRoles && roles.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>User Count</TableHead>
                        <TableHead>Allowed Pages</TableHead>
                        <TableHead>Allowed Actions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell>{role.description || '-'}</TableCell>
                          <TableCell>{role.userCount ?? 'N/A'}</TableCell>
                          <TableCell>
                            {role.allowedPages?.includes('*') 
                               ? <span className="italic">All</span>
                               : role.allowedPages?.length > 0 
                                   ? role.allowedPages.join(', ') 
                                   : '-'}
                          </TableCell>
                          <TableCell>
                            {(role as RoleDetails).allowedActions?.includes('*')
                                ? <span className="italic">All (Wildcard)</span>
                                : (role as RoleDetails).allowedActions?.length > 0
                                    ? (role as RoleDetails).allowedActions.join(', ')
                                    : 'None'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openEditRoleModal(role)}
                              disabled={role.name === 'ADMIN'}
                              title={role.name === 'ADMIN' ? 'Cannot edit ADMIN role' : 'Edit Role'} 
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="ml-2" 
                              onClick={() => openDeleteRoleDialog(role)}
                              disabled={role.name === 'ADMIN' || (role.userCount ?? 0) > 0 || isProcessingRole}
                              title={role.name === 'ADMIN' ? 'Cannot delete ADMIN role' : (role.userCount ?? 0) > 0 ? `Cannot delete: ${role.userCount} users assigned` : 'Delete Role'}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
        
        {isAdmin && (
          <TabsContent value="slicerProfiles" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Slicer Profiles</CardTitle>
                    <CardDescription>
                      Import an OrcaSlicer "Export Config Bundle" (.orca_printer) to populate the machine,
                      filament, and Slicing Profile libraries below. Assign a Machine Profile to a printer
                      (on the Printers page); filament and Slicing Profile are chosen per-slice on the Files
                      page - use "Printer Settings" below to curate which Slicing Profiles a Machine Profile
                      allows and to set its bed representation for the Slicer page's 3D view.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={openImportBundleModal} variant="outline" size="sm">
                      <PlusIcon className="h-4 w-4 mr-1" /> Import Bundle
                    </Button>
                    <Button onClick={openCreateProfileModal} variant="outline" size="sm" disabled={slicingProfiles.length === 0}>
                      <PlusIcon className="h-4 w-4 mr-1" /> Create Slicing Profile
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {slicerProfilesError && (
                  <div className="mb-4 text-sm text-red-600 bg-red-100 border border-red-300 rounded p-3">
                    Error: {slicerProfilesError}
                  </div>
                )}
                {loadingSlicerProfiles ? (
                  <p>Loading slicer profiles...</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Machine Profiles</h3>
                      {machineProfiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None imported yet.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>File</TableHead>
                              <TableHead>Printers Using It</TableHead>
                              <TableHead>Allowed Slicing Profiles</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {machineProfiles.map((profile) => (
                              <TableRow key={profile.id}>
                                <TableCell className="font-medium">{profile.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{profile.filename}</TableCell>
                                <TableCell>{profile._count.printers}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {profile.allowedSlicingProfiles.length === 0
                                    ? "All (unrestricted)"
                                    : `${profile.allowedSlicingProfiles.length} selected`}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => openAllowListModal(profile)}>
                                    Printer Settings
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteMachineProfile(profile)}
                                    disabled={profile._count.printers > 0}
                                    title={profile._count.printers > 0 ? `In use by ${profile._count.printers} printer(s)` : 'Delete Profile'}
                                  >
                                    Delete
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Filament Profiles</h3>
                      {filamentProfiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None imported yet.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>File</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filamentProfiles.map((profile) => (
                              <TableRow key={profile.id}>
                                <TableCell className="font-medium">{profile.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{profile.filename}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteFilamentProfile(profile)}>
                                    Delete
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Slicing Profiles</h3>
                      {slicingProfiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet - import a bundle that includes one.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>File</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {slicingProfiles.map((profile) => (
                              <TableRow key={profile.id}>
                                <TableCell className="font-medium">{profile.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{profile.filename}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteSlicingProfile(profile)}>
                                    Delete
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="sso" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle>Single Sign-On (SSO) & Integrations</CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Configure providers for single sign-on.</p>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Google Workspace</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">Enable sign-in with Google.</p>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Client ID</label>
                      <Input placeholder="Enter Google Client ID" defaultValue={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""} />
                        </div>
                     <div className="space-y-1">
                      <label className="text-xs font-medium">Client Secret</label>
                      <Input type="password" placeholder="Enter Google Client Secret" defaultValue={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || ""}/>
                      </div>
                     <div className="space-y-1">
                      <label className="text-xs font-medium">Authorized Redirect URI</label>
                      <Input readOnly value={redirectURIs.google} />
                      <p className="text-xs text-muted-foreground">Copy this URI into your Google Cloud Console OAuth 2.0 Client configuration.</p>
                        </div>
                    <div className="flex justify-end pt-2">
                        <Button disabled={true /* TODO: Implement save */}>Save Google Configuration</Button> 
                      </div>
                  </CardContent>
                </Card>
          <Card>
            <CardHeader>
                    <CardTitle className="text-base">Microsoft Entra ID</CardTitle>
            </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">Enable sign-in with Microsoft Entra ID (Azure AD).</p>
                     <div className="space-y-1">
                      <label className="text-xs font-medium">Tenant ID</label>
                      <Input placeholder="Enter Microsoft Entra Tenant ID" defaultValue={process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || ""}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Client ID</label>
                      <Input placeholder="Enter Microsoft Entra Client ID" defaultValue={process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || ""}/>
                </div>
                     <div className="space-y-1">
                      <label className="text-xs font-medium">Client Secret</label>
                      <Input type="password" placeholder="Enter Microsoft Entra Client Secret" defaultValue={process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_SECRET || ""}/>
              </div>
                     <div className="space-y-1">
                      <label className="text-xs font-medium">Redirect URI</label>
                      <Input readOnly value={redirectURIs.microsoftEntra} />
                      <p className="text-xs text-muted-foreground">Copy this URI into your Microsoft Entra ID App Registration configuration.</p>
                  </div>
                     <div className="flex justify-end pt-2">
                        <Button disabled={true /* TODO: Implement save */}>Save Entra ID Configuration</Button> 
                  </div>
                  </CardContent>
                </Card>
            </CardContent>
          </Card>
        </TabsContent>
        )}
        
        {isAdmin && (
          <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
                        <CardTitle>Database Management</CardTitle>
                        <CardDescription>
                           View statistics, create backups, and manage existing backups.
                        </CardDescription>
            </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Section 1: Database Statistics */}
                        <div className="space-y-3 border-b pb-4">
                            <h3 className="text-lg font-medium">Database Statistics</h3>
                            {isLoadingStats && <p>Loading statistics...</p>}
                            {statsError && <p className="text-sm text-red-600">Error: {statsError}</p>}
                            {dbStats && !isLoadingStats && !statsError && (
                                <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                                    <li>Database Size: {formatBytes(dbStats.dbSize)}</li>
                                    <li>Users: {dbStats.userCount}</li>
                                    <li>Roles: {dbStats.roleCount}</li>
                                    <li>Printers: {dbStats.printerCount}</li>
                                    <li>
                                        Last Backup: {dbStats.lastBackupDate
                                            ? `${format(new Date(dbStats.lastBackupDate), 'yyyy-MM-dd HH:mm:ss')} (${formatDistanceToNow(new Date(dbStats.lastBackupDate), { addSuffix: true })}) - ${dbStats.lastBackupFilename}`
                                            : 'Never'}
                                    </li>
                                    {/* Add more stats here if needed */}
                                </ul>
                            )}
                            {!dbStats && !isLoadingStats && !statsError && (
                                <p className="text-sm text-muted-foreground">Could not load statistics.</p>
                            )}
                      </div>
                      
                        {/* Section 2: Create Backup */}
                        <div className="space-y-3 border-b pb-4">
                            <h3 className="text-lg font-medium">Create Backup</h3>
                            <p className="text-sm text-muted-foreground">
                                Create a manual backup of the current application database (dev.db).
                                Backups are stored in the mapped backup volume.
                                Filename format: <code>printfarmname-YYYYMMDD-HHMMSS.db</code>
                            </p>
                            <Button
                                onClick={handleCreateBackup}
                                disabled={isCreatingBackup}
                            >
                               {isCreatingBackup ? <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> : null} 
                               Create Database Backup
                            </Button>
                            {isCreatingBackup && <p className="text-sm text-muted-foreground">Creating backup...</p>}
                            {backupStatusMessage && <p className="text-sm text-green-600">{backupStatusMessage}</p>}
                            {backupError && <p className="text-sm text-red-600">Error: {backupError}</p>}
                      </div>
                      
                        {/* Section 3: Existing Backups */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-medium">Existing Backups</h3>
                             <p className="text-sm text-muted-foreground">
                                Manage your existing database backups. You can download or restore from these files (Restore function coming soon).
                             </p>
                             {isLoadingBackups && <p>Loading backups...</p>}
                             {backupsError && <p className="text-sm text-red-600">Error: {backupsError}</p>}
                             {!isLoadingBackups && !backupsError && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Filename</TableHead>
                                            <TableHead className="text-right">Size</TableHead>
                                            <TableHead className="text-right">Date Modified</TableHead>
                                            <TableHead className="text-right">Download</TableHead>
                                            <TableHead className="text-right">Delete</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {backupFiles.map((backup) => (
                                            <TableRow key={backup.filename}>
                                                <TableCell className="font-medium">{backup.filename}</TableCell>
                                                <TableCell className="text-right">{formatBytes(backup.size)}</TableCell>
                                                <TableCell className="text-right">{backup.modifiedTimeFormatted}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        asChild
                                                        variant="outline" 
                                                        size="sm" 
                                                        title="Download Backup"
                                                    >
                                                        <a href={`/api/database/backups/${encodeURIComponent(backup.filename)}`} download>
                                                            <ArrowDownTrayIcon className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="destructive" 
                                                        size="sm" 
                                                        title="Delete Backup"
                                                        onClick={() => openDeleteDialog(backup.filename)}
                                                        disabled={isDeletingBackup && backupToDelete === backup.filename}
                                                    >
                                                        {isDeletingBackup && backupToDelete === backup.filename ? 
                                                            <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 
                                                            <TrashIcon className="h-4 w-4" />
                                                        }
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {backupFiles.length === 0 && (
                                          <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">No backups available.</TableCell>
                                          </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                             )}
                  </div>
                  
            </CardContent>
          </Card>
        </TabsContent>
        )}
        
        {isAdmin && (
          <TabsContent value="updates" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle>Application Updates</CardTitle>
                <CardDescription>Check for new versions and release notes from GitHub.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Future home for checking GitHub releases...</p>
                {/* TODO: Implement GitHub release checking component */}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {usersError && <p className="text-red-600">Error: {usersError}</p>}
            <Input name="name" placeholder="Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            <Input name="password" type="password" placeholder="Password" value={formData.password || ""} onChange={(e) => setFormData({...formData, password: e.target.value})} />
            <select name="roleId" value={formData.roleId ?? ''} onChange={(e) => setFormData({...formData, roleId: e.target.value || null})} className="w-full p-2 border border-border bg-background text-foreground rounded">
                <option value="">-- Select Role --</option>
                {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                ))}
             </select>
                    </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
             <Button onClick={handleAddUser} disabled={isProcessingUserAction || !formData.roleId}>
               {isProcessingUserAction ? "Adding..." : "Add User"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {usersError && <p className="text-red-600">Error: {usersError}</p>}
            <Input name="name" placeholder="Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
             <select name="roleId" value={formData.roleId ?? ''} onChange={(e) => setFormData({...formData, roleId: e.target.value || null})} className="w-full p-2 border border-border bg-background text-foreground rounded">
                 <option value="">-- Select Role --</option>
                 {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                 ))}
             </select>
                    </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
             <Button onClick={handleEditUser} disabled={isProcessingUserAction || !formData.roleId}>
               {isProcessingUserAction ? "Saving..." : "Save Changes"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password for {selectedUser?.name || selectedUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {usersError && <p className="text-red-600">Error: {usersError}</p>}
              <Input name="password" type="password" placeholder="New Password" value={formData.password || ""} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                  </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsResetPasswordModalOpen(false)}>Cancel</Button>
              <Button onClick={handleResetPassword} disabled={isProcessingUserAction || !formData.password}>
                {isProcessingUserAction ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {isAddRoleModalOpen && (
        <Dialog open={isAddRoleModalOpen} onOpenChange={setIsAddRoleModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Role</DialogTitle>
            </DialogHeader>
             {rolesError && <p className="text-sm text-red-600">{rolesError}</p>}
            <form onSubmit={handleAddRole} className="space-y-4">
                  <div>
                <Label htmlFor="new-role-name">Role Name</Label>
                <Input 
                  id="new-role-name" 
                  value={newRoleData.name}
                  onChange={(e) => setNewRoleData({ ...newRoleData, name: e.target.value })}
                  required 
                    />
                  </div>
                  <div>
                <Label htmlFor="new-role-desc">Description (Optional)</Label>
                <Input 
                  id="new-role-desc"
                  value={newRoleData.description}
                  onChange={(e) => setNewRoleData({ ...newRoleData, description: e.target.value })}
                    />
                  </div>
                  <div>
                <Label>Allowed Pages</Label>
                <div className="space-y-2 mt-2">
                  {AVAILABLE_PAGES.map((page) => (
                    <div key={page.id} className="flex items-center space-x-2">
                       <Checkbox 
                          id={`add-${page.id}`}
                          checked={newRoleData.allowedPages.includes(page.id)}
                          onCheckedChange={(checked) => handleAllowedPageChange(page.id, checked, false)}
                       />
                       <Label htmlFor={`add-${page.id}`} className="font-normal">
                         {page.label}
                       </Label>
                  </div>
                  ))}
                </div>
                    </div>
                    <div>
                <Label>Allowed Actions</Label>
                <div className="space-y-2 mt-2">
                  {AVAILABLE_ACTIONS.map((action) => (
                    <div key={action.id} className="flex items-center space-x-2">
                       <Checkbox 
                          id={`add-${action.id}`}
                          checked={newRoleData.allowedActions.includes(action.id)}
                          onCheckedChange={(checked) => handleAllowedActionChange(action.id, checked, false)}
                       />
                       <Label htmlFor={`add-${action.id}`} className="font-normal">
                         {action.label} ({action.id})
                       </Label>
                    </div>
                  ))}
                  </div>
                </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAddRoleModal} disabled={isProcessingRole}>Cancel</Button>
                <Button type="submit" disabled={isProcessingRole}>
                    {isProcessingRole ? <><ArrowPathIcon className="mr-2 h-4 animate-spin" /> Adding...</> : 'Add Role'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isEditRoleModalOpen && editingRole && (
        <Dialog open={isEditRoleModalOpen} onOpenChange={setIsEditRoleModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Role: {editingRole.name}</DialogTitle>
            </DialogHeader>
            {rolesError && <p className="text-sm text-red-600">{rolesError}</p>}
            <form onSubmit={handleEditRole} className="space-y-4">
                  <div>
                <Label htmlFor="edit-role-name">Role Name</Label>
                <Input 
                  id="edit-role-name" 
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  required 
                  disabled={editingRole.name === 'ADMIN'}
                />
                 {editingRole.name === 'ADMIN' && <p className="text-xs text-muted-foreground mt-1">The default ADMIN role name cannot be changed.</p>}
                  </div>
                  <div>
                <Label htmlFor="edit-role-desc">Description (Optional)</Label>
                <Input 
                  id="edit-role-desc"
                  value={editingRole.description || ''}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                    />
                  </div>
                  <div>
                 <Label>Allowed Pages</Label>
                 <div className="space-y-2 mt-2">
                   {AVAILABLE_PAGES.map((page) => (
                     <div key={page.id} className="flex items-center space-x-2">
                        <Checkbox 
                           id={`edit-${page.id}`}
                           checked={editingRole.allowedPages.includes(page.id)}
                           onCheckedChange={(checked) => handleAllowedPageChange(page.id, checked, true)}
                           disabled={editingRole.name === 'ADMIN'}
                        />
                        <Label htmlFor={`edit-${page.id}`} className="font-normal">
                          {page.label}
                        </Label>
                  </div>
                   ))}
                  </div>
                  {editingRole.name === 'ADMIN' && <p className="text-xs text-muted-foreground mt-1">The default ADMIN role always has access to all pages.</p>}
                </div>
                <div>
                <Label>Allowed Actions</Label>
                <div className="space-y-2 mt-2">
                  {AVAILABLE_ACTIONS.map((action) => (
                    <div key={action.id} className="flex items-center space-x-2">
                       <Checkbox 
                          id={`edit-${action.id}`}
                          checked={editingRole.allowedActions.includes(action.id)}
                          onCheckedChange={(checked) => handleAllowedActionChange(action.id, checked, true)}
                          disabled={editingRole.name === 'ADMIN'}
                        />
                        <Label htmlFor={`edit-${action.id}`} className="font-normal">
                          {action.label} ({action.id})
                        </Label>
                </div>
                  ))}
                </div>
                  </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditRoleModal} disabled={isProcessingRole}>Cancel</Button>
                <Button type="submit" disabled={isProcessingRole || editingRole.name === 'ADMIN'}>
                    {isProcessingRole ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isDeleteRoleDialogOpen && roleToDelete && (
          <Dialog open={isDeleteRoleDialogOpen} onOpenChange={setIsDeleteRoleDialogOpen}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Delete Role: {roleToDelete.name}?</DialogTitle>
                      <DialogDescription>
                          This action cannot be undone. Are you sure you want to permanently delete this role?
                      </DialogDescription>
                  </DialogHeader>
                  {rolesError && <p className="text-sm text-red-600">{rolesError}</p>}
                  <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteRoleDialogOpen(false)} disabled={isProcessingRole}>Cancel</Button>
                      <Button variant="destructive" onClick={handleDeleteRole} disabled={isProcessingRole}>
                          {isProcessingRole ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Delete Role'}
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
       )}

      {/* Delete Backup Confirmation Dialog */} 
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the backup file 
                  <code className="mx-1 font-mono bg-muted px-1 rounded">{backupToDelete}</code>.
              </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                  <p className="text-sm text-red-600">Error: {deleteError}</p>
              )}
              <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingBackup}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                  onClick={handleDeleteBackup} 
                  disabled={isDeletingBackup}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                   {isDeletingBackup ? <><ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Delete Backup'}
              </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportBundleModalOpen} onOpenChange={setIsImportBundleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Slicer Profile Bundle</DialogTitle>
            <DialogDescription>
              Export a config bundle from OrcaSlicer's GUI (File → Export → Export Config Bundle) and
              upload the resulting .orca_printer file here. Its machine and Slicing Profiles are added to
              the libraries above automatically - profiles with the same name are updated in place. If it
              includes filament profiles, you'll be asked which ones to keep next.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportBundle} className="space-y-4">
            {importBundleError && <p className="text-sm text-red-600">{importBundleError}</p>}
            <div>
              <Label htmlFor="bundle-file">Config bundle (.orca_printer)</Label>
              <Input
                id="bundle-file"
                type="file"
                accept=".orca_printer"
                onChange={(e) => setBundleFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsImportBundleModalOpen(false)} disabled={isImportingBundle}>
                Cancel
              </Button>
              <Button type="submit" disabled={isImportingBundle}>
                {isImportingBundle ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : 'Import Bundle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Post-import: pick which filaments to actually keep */}
      <Dialog open={isFilamentSelectionModalOpen} onOpenChange={setIsFilamentSelectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Filaments to Import</DialogTitle>
            <DialogDescription>
              The bundle included {filamentCandidates.length} filament profile(s). Choose which to add to
              your library.
            </DialogDescription>
          </DialogHeader>
          {importFilamentsError && <p className="text-sm text-red-600">{importFilamentsError}</p>}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filamentCandidates.map((candidate) => (
              <div key={candidate.name} className="flex items-center space-x-2">
                <Checkbox
                  id={`filament-candidate-${candidate.name}`}
                  checked={selectedFilamentNames.has(candidate.name)}
                  onCheckedChange={(checked) => toggleFilamentCandidate(candidate.name, checked === true)}
                />
                <Label htmlFor={`filament-candidate-${candidate.name}`} className="font-normal">
                  {candidate.name}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsFilamentSelectionModalOpen(false)} disabled={isImportingFilaments}>
              Skip
            </Button>
            <Button onClick={handleConfirmFilamentImport} disabled={isImportingFilaments || selectedFilamentNames.size === 0}>
              {isImportingFilaments ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : `Import ${selectedFilamentNames.size} Selected`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-machine "Printer Settings": Slicing Profile allow-list plus the
          bed STL (visual-only bed representation for the Slicer page). More
          machine-level defaults are expected to land in this modal over time. */}
      <Dialog open={!!managingAllowListFor} onOpenChange={(open) => !open && setManagingAllowListFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Printer Settings - "{managingAllowListFor?.name}"</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-1">Allowed Slicing Profiles</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Leave everything unchecked to allow the whole library. Check specific profiles to restrict
                this machine to only those when slicing.
              </p>
              {allowListError && <p className="text-sm text-red-600 mb-2">{allowListError}</p>}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {slicingProfiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Slicing Profiles in your library yet.</p>
                ) : (
                  slicingProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`allow-list-${profile.id}`}
                        checked={allowListSelectedIds.has(profile.id)}
                        onCheckedChange={(checked) => toggleAllowListProfile(profile.id, checked === true)}
                      />
                      <Label htmlFor={`allow-list-${profile.id}`} className="font-normal">
                        {profile.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-1">Bed Representation</h4>
              <p className="text-sm text-muted-foreground mb-2">
                An .stl showing the actual bed shape/texture in the Slicer page's 3D view - purely visual,
                it's never sent to OrcaSlicer or included in a slice.
              </p>
              {bedStlError && <p className="text-sm text-red-600 mb-2">{bedStlError}</p>}
              {managingAllowListFor?.bedStlFilename && (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 mb-2">
                  <span className="text-sm truncate">{managingAllowListFor.bedStlFilename}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveBedStl}
                    disabled={isSavingBedStl}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <Input
                type="file"
                accept=".stl"
                disabled={isSavingBedStl}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadBedStl(file);
                  e.target.value = "";
                }}
              />
              {isSavingBedStl && (
                <p className="text-sm text-muted-foreground mt-1">
                  <ArrowPathIcon className="inline h-3.5 w-3.5 mr-1 animate-spin" /> Saving...
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManagingAllowListFor(null)} disabled={isSavingAllowList}>
              Cancel
            </Button>
            <Button onClick={handleSaveAllowList} disabled={isSavingAllowList}>
              {isSavingAllowList ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create a new Slicing Profile by cloning an existing one and editing the curated fields */}
      <Dialog open={isCreateProfileModalOpen} onOpenChange={setIsCreateProfileModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Slicing Profile</DialogTitle>
            <DialogDescription>
              Clone an existing Slicing Profile and edit the settings below - everything else (the
              hundreds of fields OrcaSlicer needs beyond these) comes from the profile you're cloning.
            </DialogDescription>
          </DialogHeader>
          {createProfileError && <p className="text-sm text-red-600">{createProfileError}</p>}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="new-profile-base">Base Profile</Label>
                <select
                  id="new-profile-base"
                  value={newProfileBaseId}
                  onChange={(e) => setNewProfileBaseId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Select Base Profile --</option>
                  {slicingProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-profile-machine">Machine Profile</Label>
                <select
                  id="new-profile-machine"
                  value={newProfileMachineId}
                  onChange={(e) => setNewProfileMachineId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Select Machine --</option>
                  {machineProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-profile-filament">Filament Profile</Label>
                <select
                  id="new-profile-filament"
                  value={newProfileFilamentId}
                  onChange={(e) => setNewProfileFilamentId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Select Filament --</option>
                  {filamentProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-profile-name">Name</Label>
                <Input id="new-profile-name" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="new-profile-description">Description (optional)</Label>
                <Input id="new-profile-description" value={newProfileDescription} onChange={(e) => setNewProfileDescription(e.target.value)} />
              </div>
            </div>

            {previewProfileError && <p className="text-sm text-red-600">Error: {previewProfileError}</p>}
            {isPreviewingProfile && <p className="text-sm text-muted-foreground">Resolving starting values...</p>}
            {newProfileValues && (
              <SlicerSettingsTabs categories={newProfileValues} editable onFieldChange={handleNewProfileFieldChange} />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateProfileModalOpen(false)} disabled={isSavingProfile}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProfile}
              disabled={isSavingProfile || !newProfileBaseId || !newProfileName || !newProfileValues}
            >
              {isSavingProfile ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}