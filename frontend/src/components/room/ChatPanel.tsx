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

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const baseHeightRef = useRef<number>(0);

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(120, Math.max(baseHeightRef.current || 0, el.scrollHeight));
    el.style.height = `${next}px`;
  };

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const prev = el.value;
    el.value = "";
    el.style.height = "auto";
    baseHeightRef.current = el.scrollHeight;
    el.style.height = `${baseHeightRef.current}px`;
    el.value = prev;
  }, []);

  const displayMessages = useMemo(() => {
    return messages.map((m) => {
      const isSelf = m.from === "me" || m.from === selfId;
      const displayName = isSelf ? "You" : nameMap[m.from] || m.from;
      return { ...m, isSelf, displayName };
    });
  }, [messages, nameMap, selfId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [displayMessages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
    if (taRef.current) taRef.current.style.height = `${baseHeightRef.current || 0}px`;
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

  const widthStyle = isMdUp ? `${panelWidth}px` : mobileFullScreen ? "100%" : `${panelWidth}px`;

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
      <Box ref={listRef} sx={{ flex: 1, p: 1, overflowY: "auto" }}>
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
                    bgcolor: m.isSelf ? "#1976d2" : "#2b2b2e",
                    color: "#f5f5f5",
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
                      <Typography variant="caption" color="text.secondary">
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
      <Box sx={{ p: 1, backgroundColor: "#2b2b2e" }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
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
            onInput={autosize}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            autoComplete="off"
            style={{ resize: "none" }}
            sx={{
              flex: 1,
              backgroundColor: "#2b2b2e",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              outline: "none",
              borderRadius: 1,
              px: 1.25,
              py: 0.75,
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: "inherit",
              "::placeholder": { color: "#fff", opacity: 0.6 },
              overflowY: "auto",
              maxHeight: 120,
            }}
          />
          <IconButton
            onClick={handleSend}
            sx={{
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
