"use client";

import React, { useState, useEffect } from "react";
import { AddGroupForm } from "@/components/add-group-form";
import { EditGroupForm } from "@/components/edit-group-form";
import { DeleteGroupDialog } from "@/components/delete-group-dialog";
import { PlusIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";

type Printer = {
  id: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
};

type Group = {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  printers: Printer[];
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleAddGroup = async (newGroup: { name: string; description?: string; printerIds?: string[] }) => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup),
      });

      if (!response.ok) throw new Error('Failed to add group');
      
      const group = await response.json();
      setGroups(prev => [...prev, group]);
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add group:', error);
    }
  };

  const handleEditGroup = async (updatedGroup: { name: string; description?: string; printerIds?: string[] }) => {
    try {
      const response = await fetch(`/api/groups/${editingGroup?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedGroup),
      });

      if (!response.ok) throw new Error('Failed to update group');
      
      const updatedGroupData = await response.json();
      setGroups(prev => prev.map(g => g.id === editingGroup?.id ? updatedGroupData : g));
      setEditingGroup(null);
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete group');
      
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setEditingGroup(null);
      setDeletingGroup(null);
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Groups</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {showAddForm ? (
            <>
              <XMarkIcon className="h-4 w-4 mr-1" />
              Cancel
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Group
            </>
          )}
        </button>
      </div>
      
      {showAddForm && (
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Add Group</h2>
          <AddGroupForm onAdd={handleAddGroup} />
        </div>
      )}
      
      {groups.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-600">No groups found. Add a group to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-lg border bg-white p-6 shadow-sm"
            >
              {editingGroup?.id === group.id ? (
                <div>
                  <h2 className="mb-4 text-xl font-semibold">Edit Group</h2>
                  <EditGroupForm
                    group={group}
                    onSave={handleEditGroup}
                    onCancel={() => setEditingGroup(null)}
                    onDelete={() => handleDeleteGroup(group.id)}
                  />
                </div>
              ) : deletingGroup?.id === group.id ? (
                <div>
                  <h2 className="mb-4 text-xl font-semibold">Delete Group</h2>
                  <DeleteGroupDialog
                    groupName={group.name}
                    onConfirm={() => handleDeleteGroup(group.id)}
                    onCancel={() => setDeletingGroup(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{group.name}</h2>
                      {group.description && (
                        <p className="text-sm text-gray-600">{group.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingGroup(group)}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Printers in Group</h3>
                    {group.printers.length === 0 ? (
                      <p className="text-sm text-gray-600">No printers in this group</p>
                    ) : (
                      <div className="space-y-2">
                        {group.printers.map((printer) => (
                          <div
                            key={printer.id}
                            className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                          >
                            <span className="text-sm">{printer.name}</span>
                            <div className="flex gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  printer.operationalStatus === "printing"
                                    ? "bg-green-100 text-green-800"
                                    : printer.operationalStatus === "idle"
                                    ? "bg-blue-100 text-blue-800"
                                    : printer.operationalStatus === "offline"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {printer.operationalStatus}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  printer.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : printer.status === "disabled"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {printer.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 