'use client'

import * as React from 'react';
import { useAuthContext } from '../context/AuthProvider';
import AddGroupModal from '../components/groups/AddGroupModal';
import GroupCard from '../components/groups/GroupCard';
import { useGroups } from '../context/GroupContext';
import axiosInstance from '../api/axiosInstance';
import { Button } from '../components/ui/button';
import { Plus } from 'lucide-react';

export default function Home() {
  const { user } = useAuthContext();
  const { groups, loading, refresh } = useGroups();
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = async () => {
    setOpen(false);
    await refresh();
  };
  const handleJoinOrLeave = async () => {
    await refresh();
  };

  const renderContent = () => {
    if (loading && groups.length === 0) {
      return (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (groups.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="inline-block p-6 bg-card border border-border rounded-2xl mb-6">
            <Plus className="w-12 h-12 text-primary/50 mx-auto" />
          </div>
          <h3 className="text-xl text-foreground/70 mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6">Create the first one and start practicing!</p>
          <Button onClick={handleOpen} className="md:hidden">
            <Plus className="w-4 h-4 mr-2" />
            Add Group
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            onJoinSuccess={handleJoinOrLeave}
            onLeaveSuccess={handleJoinOrLeave}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 sm:pt-8 sm:pb-8 xl:max-w-[88rem]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-primary">
            Groups
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome{user?.name ? `, ${user.name}` : ''}. Find your vibe.
          </p>
        </div>

        <div className="hidden sm:block">
          <Button onClick={handleOpen}>
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </div>
      </div>

      <AddGroupModal open={open} handleClose={handleClose} />

      <div className="min-h-[55vh]">{renderContent()}</div>

      {loading && groups.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-[#E08B70] sm:hidden"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label="add group"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
