"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Printer = {
  id: string;
  name: string;
  type: string;
  groupId?: string | null;
};

type Group = {
  id: string;
  name: string;
  description?: string | null;
  order: number;
  printers: Printer[];
};

function GroupFormFields({
  name,
  setName,
  description,
  setDescription,
  allPrinters,
  selectedPrinterIds,
  togglePrinter,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  allPrinters: Printer[];
  selectedPrinterIds: Set<string>;
  togglePrinter: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Printers in this group</label>
        <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 divide-y">
          {allPrinters.length === 0 ? (
            <p className="text-sm text-gray-500 p-3">No printers yet.</p>
          ) : (
            allPrinters.map((printer) => (
              <label key={printer.id} className="flex items-center gap-2 p-2 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedPrinterIds.has(printer.id)}
                  onChange={() => togglePrinter(printer.id)}
                />
                <span>{printer.name}</span>
                <span className="text-gray-400">({printer.type})</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [groups, setGroups] = useState<Group[]>([]);
  const [allPrinters, setAllPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPrinterIds, setSelectedPrinterIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, printersRes] = await Promise.all([fetch("/api/groups"), fetch("/api/printers")]);
      if (!groupsRes.ok || !printersRes.ok) throw new Error("Failed to load groups");
      const groupsData: Group[] = await groupsRes.json();
      const printersData: Printer[] = await printersRes.json();
      setGroups(groupsData.sort((a, b) => a.order - b.order));
      setAllPrinters(printersData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedPrinterIds(new Set());
  };

  const togglePrinter = (id: string) => {
    setSelectedPrinterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setName(group.name);
    setDescription(group.description || "");
    setSelectedPrinterIds(new Set(group.printers.map((p) => p.id)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, printerIds: Array.from(selectedPrinterIds) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create group");
      setShowCreateForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    try {
      const res = await fetch(`/api/groups/${editingGroup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, printerIds: Array.from(selectedPrinterIds) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update group");
      setEditingGroup(null);
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group");
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    try {
      const res = await fetch(`/api/groups/${deletingGroup.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete group");
      setDeletingGroup(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    }
  };

  const moveGroup = async (groupId: string, direction: "up" | "down") => {
    const index = groups.findIndex((g) => g.id === groupId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const reordered = [...groups];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    try {
      const res = await fetch("/api/groups/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reordered.map((g, i) => ({ id: g.id, order: i }))),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to reorder groups");
      const updated: Group[] = await res.json();
      setGroups(updated.sort((a, b) => a.order - b.order));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder groups");
    }
  };

  if (status === "loading") {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600 mb-4">Please sign in to manage groups.</p>
        <Link href="/auth/signin" className="text-blue-600 hover:underline">Sign in</Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Only admins can manage groups.</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Groups</h1>
        <button
          onClick={() => { resetForm(); setShowCreateForm(true); }}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Create Group
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading groups...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-gray-500">
          No groups yet. Create one to organize printers on the dashboard.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <div key={group.id} className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{group.name}</h2>
                  {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
                  <p className="text-sm text-gray-600 mt-2">
                    {group.printers.length === 0
                      ? "No printers assigned"
                      : group.printers.map((p) => p.name).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveGroup(group.id, "up")}
                    disabled={index === 0}
                    className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveGroup(group.id, "down")}
                    disabled={index === groups.length - 1}
                    className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => openEdit(group)}
                    className="px-3 py-1.5 rounded bg-gray-100 text-sm hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingGroup(group)}
                    className="px-3 py-1.5 rounded bg-red-100 text-red-700 text-sm hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowCreateForm(false)} />
            <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-semibold mb-4">Create Group</h2>
              <form onSubmit={handleCreate}>
                <GroupFormFields
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  allPrinters={allPrinters}
                  selectedPrinterIds={selectedPrinterIds}
                  togglePrinter={togglePrinter}
                />
                <div className="mt-6 flex gap-2">
                  <button type="submit" className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setEditingGroup(null)} />
            <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-semibold mb-4">Edit Group</h2>
              <form onSubmit={handleSaveEdit}>
                <GroupFormFields
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  allPrinters={allPrinters}
                  selectedPrinterIds={selectedPrinterIds}
                  togglePrinter={togglePrinter}
                />
                <div className="mt-6 flex gap-2">
                  <button type="submit" className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deletingGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setDeletingGroup(null)} />
            <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold text-red-600 mb-4">Delete Group</h2>
              <p className="text-sm text-gray-600 mb-6">
                Delete "{deletingGroup.name}"? Printers in this group will become ungrouped, not deleted.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">
                  Delete
                </button>
                <button
                  onClick={() => setDeletingGroup(null)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
