import { useSession } from "next-auth/react";

/**
 * Custom hook to check user permissions based on session data.
 * Provides a 'can' function to verify if the user has a specific action allowed.
 */
export function usePermissions() {
  const { data: session } = useSession();

  /**
   * Checks if the current user has permission for a given action.
   * @param action The action string to check (e.g., 'users:create', 'roles:edit').
   * @returns True if the user has the permission, false otherwise.
   */
  const can = (action: string): boolean => {
    const allowedActions = session?.user?.allowedActions;

    // Default to false if no session or no actions array
    if (!allowedActions) {
      return false;
    }

    // Admins (or roles with wildcard) can do anything
    if (allowedActions.includes('*')) {
      return true;
    }

    // Check if the specific action is present in the array
    return allowedActions.includes(action);
  };

  // You could add more permission-related logic here if needed

  return { can, role: session?.user?.role }; // Return 'can' function and optionally the role
} 