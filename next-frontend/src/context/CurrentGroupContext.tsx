'use client'

import React, { createContext, useContext, useMemo } from "react";
import { useGroups, type Group } from "./GroupContext";

const CurrentGroupContext = createContext<Group | null>(null);
export const useCurrentGroup = () => useContext(CurrentGroupContext);

type Props = {
  roomId: string;
  children: React.ReactNode;
};

export function CurrentGroupProvider({ roomId, children }: Props) {
  const { groups } = useGroups();

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
