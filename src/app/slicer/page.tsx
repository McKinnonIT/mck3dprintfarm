"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { canAccessPage } from "@/lib/rbacUtils";
import { toast } from "sonner";
import { SlicePanel, SlicePanelFile } from "@/components/slice-panel";

export default function SlicerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const allowedPages = session?.user?.allowedPages;
  const hasAccess = canAccessPage(allowedPages, "/slicer");

  const [files, setFiles] = useState<SlicePanelFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a successful slice to remount SlicePanel with a fresh, blank plate.
  const [panelKey, setPanelKey] = useState(0);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    } else if (!hasAccess) {
      router.replace("/access-denied");
    }
  }, [status, hasAccess, router]);

  const fetchFiles = useCallback(async () => {
    if (status !== "authenticated" || !hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/files");
      if (!response.ok) throw new Error("Failed to fetch files");
      setFiles(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [status, hasAccess]);

  useEffect(() => {
    if (status === "authenticated" && hasAccess) {
      fetchFiles();
    }
  }, [status, hasAccess, fetchFiles]);

  if (status === "loading" || (status === "authenticated" && !hasAccess)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Slicer</h1>
        <p className="text-sm text-muted-foreground">
          Starts on a blank Prusa build plate - add one or more of your files below, arrange them, then slice.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-400 bg-red-100 p-4 text-red-700">
          <p>
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading files...</p>
      ) : (
        <SlicePanel
          key={panelKey}
          files={files}
          defaultMachineProfileQuery="prusa"
          onSliced={({ fileName }) => {
            toast.success(`Sliced "${fileName}" successfully!`);
            fetchFiles();
            setPanelKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
