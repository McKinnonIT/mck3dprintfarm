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