import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Divider,
  Stack,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import MemberAvatar from "../ui/MemberAvatar";

type ChatMessage = { id: string; from: string; text: string; ts: number };

interface ChatPanelProps {
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onTyping: (on: boolean) => void;
  nameMap?: Record<string, string>;
  selfId?: string;
  panelWidth?: number;         // width on desktop/tablet (default 340)
  mobileFullScreen?: boolean;  // if true, takes full screen on mobile
}

const isIOSMobile = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  typeof window !== "undefined" &&
  window.innerWidth < 900;

const MIN_HEIGHT = 40;   // one-line comfy height
const MAX_HEIGHT = 160;  // cap before inner scrolling kicks in

export default function ChatPanel({
  onClose,
  messages,
  onSend,
  onTyping,
  nameMap = {},
  selfId,
  panelWidth = 340,
  mobileFullScreen = true,
}: ChatPanelProps) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const [kbInset, setKbInset] = useState(0);
  const [composerH, setComposerH] = useState(0);

  

  const updateComposerHeight = () => {
    if (composerRef.current) setComposerH(composerRef.current.offsetHeight || 0);
  };

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    // reset height, measure, then clamp
    el.style.height = "auto";
    const needed = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight));
    el.style.height = `${needed}px`;
    el.style.overflowY = needed >= MAX_HEIGHT ? "auto" : "hidden";
    updateComposerHeight();
  };

  // init heights
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const base = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight || MIN_HEIGHT));
    el.style.height = `${base}px`;
    el.style.overflowY = "hidden";
    updateComposerHeight();
  }, []);

  // iOS keyboard overlap handling
  useEffect(() => {
    if (!isIOSMobile() || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onVV = () => {
      const overlap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKbInset(overlap);
      updateComposerHeight();
    };
    vv.addEventListener("resize", onVV);
    vv.addEventListener("scroll", onVV);
    onVV();
    return () => {
      vv.removeEventListener("resize", onVV);
      vv.removeEventListener("scroll", onVV);
    };
  }, []);

  const displayMessages = useMemo(() => {
    return messages.map((m) => {
      const isSelf = m.from === "me" || m.from === selfId;
      const displayName = isSelf ? "You" : nameMap[m.from] || m.from;
      return { ...m, isSelf, displayName };
    });
  }, [messages, nameMap, selfId]);

  // only autoscroll when near bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [displayMessages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    onSend(text);
    setInput("");

    const el = taRef.current;
    if (el) {
      el.value = "";
      el.style.height = "auto";
      const base = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight || MIN_HEIGHT));
      el.style.height = `${base}px`;
      el.style.overflowY = "hidden";
    }

    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
    updateComposerHeight();
  }

  function handleChange(v: string) {
    setInput(v);
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 1000);
    }
  }

  const widthStyle = isMdUp
    ? `${panelWidth}px`
    : mobileFullScreen
    ? "100%"
    : `${panelWidth}px`;

  return (
    <Box
      sx={{
        width: widthStyle,
        borderLeft: isMdUp ? "1px solid" : "none",
        borderColor: "divider",
        backgroundColor: "#0e0e0f",
        display: "flex",
        flexDirection: "column",
        position: isMdUp ? "absolute" : "fixed",
        right: 0,
        top: isMdUp ? 0 : 0,
        bottom: 0,
        left: isMdUp ? "auto" : 0,
        color: "#f5f5f5",
        zIndex: (t) => (isMdUp ? t.zIndex.appBar - 1 : t.zIndex.drawer + 10),
        boxShadow: isMdUp ? "none" : 8,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "#1a1a1c",
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} color="#f5f5f5">
          Chat
        </Typography>
        <Tooltip title="Close">
          <IconButton onClick={onClose} size="small" sx={{ color: "#f5f5f5" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider sx={{ borderColor: "#2a2a2d" }} />

      {/* Messages */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          p: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
          pb: `${composerH + 8}px`, // leave space for composer
          ...(isIOSMobile() ? { marginBottom: `${kbInset}px` } : {}),
        }}
      >
        {displayMessages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, pt: 1 }}>
            Messages will appear here
          </Typography>
        ) : (
          <List dense sx={{ pr: 1 }}>
            {displayMessages.map((m) => (
              <ListItem
                key={m.id}
                sx={{
                  alignItems: "flex-start",
                  px: 0.5,
                  justifyContent: m.isSelf ? "flex-end" : "flex-start",
                }}
              >
                {!m.isSelf && (
                  <MemberAvatar
                    member={{ id: m.from, name: m.displayName }}
                    avatarSize={32}
                    sxBox={{ width: "auto", flexShrink: 0, mr: 0.75 }}
                    sxAvatar={{ width: 32, height: 32 }}
                    withName={false}
                  />
                )}

                <Stack
                  spacing={0.25}
                  sx={{
                    maxWidth: "78%",
                    background: m.isSelf
                      ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                      : "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
                    color: "#fff",
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 1.5,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      {m.displayName}
                    </Typography>
                    <Tooltip title={new Date(m.ts).toLocaleTimeString()}>
                      <Typography variant="caption" color="white">
                        {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </Tooltip>
                  </Stack>
                  <ListItemText
                    primaryTypographyProps={{
                      variant: "body2",
                      sx: { wordBreak: "break-word", whiteSpace: "pre-wrap" },
                    }}
                    primary={m.text}
                    sx={{ m: 0 }}
                  />
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Composer */}
      <Divider sx={{ borderColor: "#2a2a2d" }} />
      <Box
        ref={composerRef}
        sx={{
          p: 1,
          backgroundColor: "#2b2b2e",
          overflowX: "hidden",
          position: isIOSMobile() ? "fixed" : "static",
          left: isIOSMobile() ? 0 : undefined,
          right: isIOSMobile() ? 0 : undefined,
          bottom: isIOSMobile() ? 0 : undefined,
          pb: isIOSMobile() ? `calc(1rem + env(safe-area-inset-bottom, 0px))` : 1,
          zIndex: isIOSMobile() ? (t) => t.zIndex.appBar + 2 : "auto",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            width: "100%",
            maxWidth: "100%",
            flexWrap: "nowrap",
            overflow: "hidden",
            "& > *": { minWidth: 0 },
          }}
        >
          <Box
            component="textarea"
            ref={taRef}
            rows={1}
            placeholder="Type a message"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              handleChange(e.target.value);
              autosize();
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
            autoCapitalize="none"
            style={{ resize: "none" }}
            sx={{
              flex: 1,
              minWidth: 0,
              display: "block",
              boxSizing: "border-box",     // important for stable autosize
              backgroundColor: "#2b2b2e",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              outline: "none",
              borderRadius: 1,
              px: 1.25,
              pt: 0.75,
              pb: 0.75,
              fontSize: 16,                // iOS: prevent zoom
              lineHeight: "20px",          // crisp top-aligned typing
              fontFamily: "inherit",
              overflowY: "hidden",         // autosize until MAX then switch to auto
              maxHeight: MAX_HEIGHT,
              WebkitTextSizeAdjust: "100%",
              "::placeholder": { color: "#fff", opacity: 0.6 },
            }}
          />

          <IconButton
            onClick={handleSend}
            sx={{
              flex: "0 0 auto",
              color: "#fff",
              backgroundColor: "#2b2b2e",
              border: "1px solid rgba(255,255,255,0.24)",
              "&:hover": { backgroundColor: "#2b2b2e" },
            }}
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}

