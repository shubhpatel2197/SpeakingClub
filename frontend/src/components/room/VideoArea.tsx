import React, { useEffect, useState } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";

type Props = {
  isSharingScreen: boolean;
  screenSharerId: string | null;
  screenSharerName?: string | null;
  chatWidth?: number; // default 340
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
    } catch {}
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
    } catch {}
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
    <Box
      sx={{
        pr: `${chatWidth}px`,     // keep space for chat
        flex: 1,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        minHeight: 0,            // IMPORTANT for flex children to size correctly
      }}
    >
      <Box
        id="screen-stage-container"
        tabIndex={0}
        onDoubleClick={toggleFullscreen}
        sx={{
          width: "98%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          bgcolor: "#000",
          borderRadius: 2,
          boxShadow: 3,
          overflow: "hidden",
          position: "relative",
          outline: "none",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "stretch",
          // When fullscreen, video fills container
          "&:fullscreen video, &:-webkit-full-screen video": {
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000",
          },
        }}
      >
        <video
          id="screen-stage"
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            background: "#000",
          }}
        />

        {!screenSharerId && !isSharingScreen ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.7)",
              fontSize: 16,
              pointerEvents: "none",
            }}
          >
            No one is sharing
          </Box>
        ) : null}

        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            gap: 1,
            zIndex: 2,
          }}
        >
          <Tooltip
            title={isStageFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          >
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              sx={{
                bgcolor: "rgba(0,0,0,0.5)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
              }}
            >
              {isStageFullscreen ? (
                <FullscreenExitIcon />
              ) : (
                <FullscreenIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
