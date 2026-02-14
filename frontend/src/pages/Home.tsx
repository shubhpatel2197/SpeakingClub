import * as React from 'react';
import { useAuthContext } from '../context/AuthProvider';
import AddGroupModal from '../components/groups/AddGroupModal';
import GroupCard from '../components/groups/GroupCard';
import { useGroups } from '../context/GroupContext';
import * as Sentry from "@sentry/react";
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
          <div className="inline-block p-6 glass rounded-2xl glow-purple mb-6">
            <Plus className="w-12 h-12 text-primary/50 mx-auto" />
          </div>
          <h3 className="text-xl font-display text-foreground/70 mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6">Create the first one and start practicing!</p>
          <Button onClick={handleOpen} className="md:hidden">
            <Plus className="w-4 h-4 mr-2" />
            Add Group
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold gradient-text">
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
        className="sm:hidden fixed right-4 bottom-6 z-40 w-14 h-14 rounded-full btn-gradient text-white shadow-xl flex items-center justify-center animate-pulse-glow"
        aria-label="add group"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
