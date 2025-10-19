import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { CurrentGroupProvider } from "../context/CurrentGroupContext";
const Room = React.lazy(() => import("../pages/Room"));

export function RoomRouteWrapper() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;

  return (
    <CurrentGroupProvider roomId={id} fallback={<div>Loading room…</div>}>
      <Room />
    </CurrentGroupProvider>
  );
}
