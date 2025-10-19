import React, { createContext, useContext, useMemo } from "react";
import { useGroups, type Group } from "./GroupContext";

const CurrentGroupContext = createContext<Group | null>(null);
export const useCurrentGroup = () => useContext(CurrentGroupContext);

type Props = {
  roomId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode; // optional custom loader
};

export function CurrentGroupProvider({ roomId, children, fallback }: Props) {
  const { groups, loading } = useGroups();

  // show a loader while groups are being fetched
  if (loading) {
    return (
      <>
        {fallback ?? (
          <div style={{ padding: 16 }}>loading room data…</div>
        )}
      </>
    );
  }

  const current = useMemo(
    () => groups.find((g) => g.id === roomId) ?? null,
    [groups, roomId]
  );

  return (
    <CurrentGroupContext.Provider value={current}>
      {children}
    </CurrentGroupContext.Provider>
  );
}
