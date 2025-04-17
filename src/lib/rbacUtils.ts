/**
 * Checks if a user's allowed pages grant access to a specific page path.
 * Handles wildcard ('*') access and parent path access (e.g., /settings allows /settings/users).
 * 
 * @param allowedPages - An array of page paths the user is allowed to access, or undefined/null.
 * @param pagePath - The path of the page being accessed.
 * @returns True if access is granted, false otherwise.
 */
export const canAccessPage = (allowedPages: string[] | undefined | null, pagePath: string): boolean => {
    if (!allowedPages) {
        // console.log(`canAccessPage: No allowedPages array provided for path ${pagePath}. Denying access.`);
        return false; 
    }
    
    // Explicitly check for wildcard access
    if (allowedPages.includes('*')) {
        // console.log(`canAccessPage check for ${pagePath}: GRANTED (Wildcard access). Allowed:`, allowedPages);
        return true;
    }

    // Check for exact match or if a parent path is allowed
    const hasAccess = allowedPages.some(allowedPath => 
        pagePath === allowedPath || pagePath.startsWith(allowedPath + '/')
    );
    // console.log(`canAccessPage check for ${pagePath}: ${hasAccess ? 'GRANTED' : 'DENIED'}. Allowed:`, allowedPages);
    return hasAccess;
}; 

/**
 * Checks if a user's allowed actions permit a specific action.
 * Handles wildcard ('*') access.
 * 
 * @param allowedActions - An array of action strings the user is allowed to perform, or undefined/null.
 * @param action - The action string being checked (e.g., 'jobs:create', 'users:edit').
 * @returns True if the action is permitted, false otherwise.
 */
export const canPerformAction = (allowedActions: string[] | undefined | null, action: string): boolean => {
    if (!allowedActions) {
        // console.log(`canPerformAction: No allowedActions array provided for action ${action}. Denying.`);
        return false;
    }

    // Check for wildcard or direct match
    const hasPermission = allowedActions.includes('*') || allowedActions.includes(action);
    // console.log(`canPerformAction check for ${action}: ${hasPermission ? 'GRANTED' : 'DENIED'}. Allowed:`, allowedActions);
    return hasPermission;
}; 