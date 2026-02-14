import React, { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";

type Props = {
  isSharingScreen: boolean;
  screenSharerId: string | null;
  screenSharerName?: string | null;
  chatWidth?: number;
};

export default function VideoArea({
  isSharingScreen,
  screenSharerId,
  screenSharerName,
  chatWidth = 340,
}: Props) {
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);

  function getStageContainer(): HTMLElement | null {
    return document.getElementById("screen-stage-container");
  }
  function getStageVideo(): HTMLVideoElement | null {
    return document.getElementById("screen-stage") as HTMLVideoElement | null;
  }

  const enterFullscreen = async () => {
    const container = getStageContainer();
    const video = getStageVideo();
    try {
      const anyVideo = video as any;
      if (anyVideo && typeof anyVideo.webkitEnterFullscreen === "function") {
        anyVideo.webkitEnterFullscreen();
        setIsStageFullscreen(true);
        return;
      }
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
        return;
      }
      const anyContainer = container as any;
      if (anyContainer?.webkitRequestFullscreen) {
        await anyContainer.webkitRequestFullscreen();
        return;
      }
      if (anyContainer?.msRequestFullscreen) {
        await anyContainer.msRequestFullscreen();
        return;
      }
    } catch { }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const anyDoc = document as any;
      if (anyDoc.webkitFullscreenElement) {
        await anyDoc.webkitExitFullscreen?.();
        return;
      }
      if (anyDoc.msFullscreenElement) {
        await anyDoc.msExitFullscreen?.();
        return;
      }
    } catch { }
  };

  const toggleFullscreen = async () => {
    const inFs =
      !!document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement ||
      isStageFullscreen;

    if (inFs) await exitFullscreen();
    else await enterFullscreen();
  };

  useEffect(() => {
    const onChange = () => {
      const inFs =
        !!document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement;
      setIsStageFullscreen(!!inFs);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    document.addEventListener("MSFullscreenChange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
      document.removeEventListener("MSFullscreenChange", onChange as any);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") {
        const container = getStageContainer();
        if (!container) return;
        if (
          container.contains(document.activeElement) ||
          (container as any).matches?.(":hover")
        ) {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="flex-1 flex items-stretch justify-center min-h-0"
      style={{ paddingRight: `${chatWidth}px` }}
    >
      <div
        id="screen-stage-container"
        tabIndex={0}
        onDoubleClick={toggleFullscreen}
        className="w-[98%] h-full max-w-full max-h-full bg-black rounded-xl shadow-lg overflow-hidden relative outline-none flex items-stretch justify-stretch [&:fullscreen_video]:w-full [&:fullscreen_video]:h-full [&:fullscreen_video]:object-contain"
      >
        <video
          id="screen-stage"
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain block bg-black"
        />

        {!screenSharerId && !isSharingScreen && (
          <div className="absolute inset-0 flex items-center justify-center text-foreground/50 text-sm pointer-events-none">
            No one is sharing
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1 z-[2]">
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            title={isStageFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          >
            {isStageFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
