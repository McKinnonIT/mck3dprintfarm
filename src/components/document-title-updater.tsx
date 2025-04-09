"use client";

import { useEffect, useState } from 'react';

export default function DocumentTitleUpdater() {
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(null);

  useEffect(() => {
    // Fetch settings when component mounts
    const fetchSiteTitle = async () => {
      try {
        console.log("[DocumentTitleUpdater] Fetching settings from /api/settings...");
        const response = await fetch("/api/settings"); // Fetch from API
        if (!response.ok) {
          throw new Error(`Failed to fetch settings: ${response.statusText}`);
        }
        const settings = await response.json();
        const titleFromApi = settings?.printFarmTitle;
        console.log("[DocumentTitleUpdater] Title from API:", titleFromApi);
        if (titleFromApi) {
          setFetchedTitle(titleFromApi);
        } else {
          setFetchedTitle("Print Farm"); // Use default if API doesn't provide one
          console.log("[DocumentTitleUpdater] API didn't return title, using default.");
        }
      } catch (error) {
        console.error("[DocumentTitleUpdater] Error fetching title:", error);
        setFetchedTitle("Print Farm"); // Use default on error
      }
    };

    fetchSiteTitle();
  }, []); // Empty dependency array means run only once on mount

  // Effect to update document.title when fetchedTitle state changes
  useEffect(() => {
    if (fetchedTitle) {
      console.log(`[DocumentTitleUpdater] Updating document title to: ${fetchedTitle}`);
      document.title = fetchedTitle;
    }
  }, [fetchedTitle]);

  // Component doesn't render anything visible
  return null;
} 