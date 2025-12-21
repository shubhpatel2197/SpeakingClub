import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { CurrentGroupProvider } from "../context/CurrentGroupContext";
import { Suspense } from "react";

export default function RoomRouteWrapper() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const Room = React.lazy(() =>
    Promise.all([import("../pages/Room"), wait(2000)]).then(([mod]) => ({
      default: mod.default,
    }))
  );

  return (
    <CurrentGroupProvider roomId={id} fallback={<div>Loading room…</div>}>
      <Suspense fallback={<div>Loading room…</div>}>
        <Room />
      </Suspense>
    </CurrentGroupProvider>
  );
}
