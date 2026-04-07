'use client'

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Users, Plus, Bell, Check, X, UserMinus, Trash2, Phone } from "lucide-react";
import { Button } from "../ui/button";
import MemberAvatar from "../ui/MemberAvatar";
import axiosInstance from "../../api/axiosInstance";
import { io, Socket } from "socket.io-client";
import { getAuthToken } from "../../lib/authToken";
import { useRouter } from "next/navigation";
import { useSnackbar } from "../../context/SnackbarProvider";

type FriendEntry = {
  id: string;
  friendId: string;
  name: string | null;
  avatar: string | null;
  since: string;
};

type FriendRequest = {
  id: string;
  fromId: string;
  name: string | null;
  avatar: string | null;
  createdAt: string;
};

type MatchEntry = {
  id: string;
  partnerId: string;
  name: string | null;
  avatar: string | null;
  chatAt: string;
};

type FriendReqsHook = {
  requests: FriendRequest[];
  count: number;
  acceptedVersion: number;
  fetchRequests: () => Promise<void>;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
};

type Props = {
  onNewChat: () => void;
  friendReqs: FriendReqsHook;
  matchVersion?: number;
  friendsVersion?: number;
  onFriendAccepted?: () => void;
  mobile?: boolean;
  onClose?: () => void;
};

export default function ChatSidebar({
  onNewChat,
  friendReqs,
  matchVersion = 0,
  friendsVersion = 0,
  onFriendAccepted,
  mobile = false,
  onClose,
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [callingFriendId, setCallingFriendId] = useState<string | null>(null);
  const friendChatSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchFriends();
    fetchMatches();
  }, []);

  useEffect(() => {
    return () => {
      try {
        friendChatSocketRef.current?.disconnect();
      } catch {}
      friendChatSocketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (friendReqs.acceptedVersion > 0) {
      fetchFriends();
      onFriendAccepted?.();
    }
  }, [friendReqs.acceptedVersion, onFriendAccepted]);

  // Re-fetch matches when matchVersion changes (on skip / partner-left)
  useEffect(() => {
    if (matchVersion > 0) fetchMatches();
  }, [matchVersion]);

  // Re-fetch friends when friendsVersion changes (e.g., unfriend from chat room)
  useEffect(() => {
    if (friendsVersion > 0) fetchFriends();
  }, [friendsVersion]);

  // Load full request list when expanding or when count changes from 0 to >0
  useEffect(() => {
    if (showRequests || friendReqs.count > 0) {
      friendReqs.fetchRequests();
    }
  }, [showRequests, friendReqs.count]);

  const fetchFriends = async () => {
    try {
      const { data } = await axiosInstance.get("/api/friends");
      setFriends(data.friends || []);
    } catch {}
  };

  const fetchMatches = async () => {
    try {
      const { data } = await axiosInstance.get("/api/matches");
      setMatches(data.matches || []);
    } catch {}
  };

  const handleAccept = async (requestId: string) => {
    // Optimistically add to friends list from the request data
    const req = friendReqs.requests.find((r) => r.id === requestId);
    if (req) {
      setFriends((prev) => [
        {
          id: requestId, // placeholder; will be corrected on next fetch
          friendId: req.fromId,
          name: req.name,
          avatar: req.avatar,
          since: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    await friendReqs.accept(requestId);
  };

  const handleReject = async (requestId: string) => {
    await friendReqs.reject(requestId);
  };

  const [confirmUnfriend, setConfirmUnfriend] = useState<string | null>(null);

  const handleUnfriend = (friendshipId: string) => {
    if (confirmUnfriend !== friendshipId) {
      setConfirmUnfriend(friendshipId);
      return;
    }
    setConfirmUnfriend(null);
    setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    axiosInstance.delete(`/api/friends/${friendshipId}`).catch(() => {});
  };

  const handleRemoveMatch = (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    axiosInstance.delete(`/api/matches/${matchId}`).catch(() => {});
  };

  const handleStartFriendChat = (friend: FriendEntry) => {
    if (callingFriendId) return;

    const socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || "/", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: {
        token: getAuthToken(),
      },
      reconnection: false,
    });

    friendChatSocketRef.current = socket;
    setCallingFriendId(friend.friendId);

    const cleanupSocket = () => {
      try {
        socket.disconnect();
      } catch {}
      if (friendChatSocketRef.current === socket) {
        friendChatSocketRef.current = null;
      }
      setCallingFriendId((prev) => (prev === friend.friendId ? null : prev));
    };

    socket.on("connect", () => {
      socket.emit("friendChat:invite", { friendId: friend.friendId }, (res: any) => {
        if (res?.ok) return;

        const errorMessage =
          res?.error === "friend_offline"
            ? `${friend.name || "Your friend"} is offline right now.`
            : res?.error === "not_friends"
              ? "You can only start a private chat with accepted friends."
              : "Could not start a private chat.";
        showSnackbar(errorMessage, { severity: "error" });
        cleanupSocket();
      });
    });

    socket.on("friendChat:ready", ({ roomId }: { roomId: string }) => {
      cleanupSocket();
      router.push(`/room/${encodeURIComponent(roomId)}`);
    });

    socket.on("friendChat:declined", () => {
      showSnackbar(`${friend.name || "Your friend"} declined the chat invite.`, { severity: "info" });
      cleanupSocket();
    });

    socket.on("connect_error", () => {
      showSnackbar("Could not connect to start the private chat.", { severity: "error" });
      cleanupSocket();
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className={`flex h-full w-full flex-col bg-[#1A1D24] ${mobile ? "" : "border-r border-border"}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground font-semibold text-base">Chats</h2>
            {mobile && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Friends, requests, and recent matches
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onNewChat}
              className="h-8 rounded-xl px-3 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Chat
            </Button>
            {mobile && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-[#1D2128] text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close chat drawer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Top half: Friends ─── */}
      <div className="flex-1 min-h-0 flex flex-col border-b border-border">
        <div className="px-4 py-2 flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-[#7F9486]" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Friends
          </span>
          {friends.length > 0 && (
            <span className="text-[10px] bg-[#7F9486]/15 text-[#7F9486] font-bold px-1.5 py-0.5 rounded">
              {friends.length}
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="relative p-1.5 rounded-lg hover:bg-[#1D2128] transition-colors"
            >
              <Bell className={`h-3.5 w-3.5 ${friendReqs.count > 0 ? "text-[#7F9486]" : "text-muted-foreground/50"}`} />
              {friendReqs.count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                  {friendReqs.count}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {/* Pending requests (expandable) */}
          {showRequests && friendReqs.requests.length > 0 && (
            <div className="mb-2 space-y-1">
              <p className="px-3 py-1 text-[10px] font-semibold text-[#7F9486] uppercase tracking-wider">
                Friend Requests
              </p>
              {friendReqs.requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#7F9486]/5 border border-[#7F9486]/15"
                >
                  <MemberAvatar
                    member={{ id: req.fromId, name: req.name, avatar: req.avatar }}
                    avatarSize={32}
                    withName={false}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {req.name || "User"}
                    </p>
                    <p className="text-[10px] text-[#7F9486]">Friend request</p>
                  </div>
                  <button
                    onClick={() => handleAccept(req.id)}
                    className="w-7 h-7 rounded-lg bg-[#7F9486] text-white flex items-center justify-center hover:bg-[#6d8275] transition-all active:scale-90"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="w-7 h-7 rounded-lg bg-[#1D2128] border border-border text-muted-foreground flex items-center justify-center hover:text-red-400 hover:border-red-400/30 transition-all active:scale-90"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Auto-show requests if there are new ones and panel is closed */}
          {!showRequests && friendReqs.count > 0 && (
            <button
              onClick={() => setShowRequests(true)}
              className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-xl bg-[#7F9486]/10 border border-[#7F9486]/20 text-left hover:bg-[#7F9486]/15 transition-colors"
            >
              <Bell className="h-3.5 w-3.5 text-[#7F9486]" />
              <span className="text-xs font-medium text-[#7F9486]">
                {friendReqs.count} new friend request{friendReqs.count > 1 ? "s" : ""}
              </span>
            </button>
          )}

          {/* Friend list */}
          {friends.length === 0 && friendReqs.count === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
              <Users className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-muted-foreground/50 text-xs text-center">
                No friends yet. Add friends from your chats!
              </p>
            </div>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                className="group/friend w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#1D2128] transition-colors"
              >
                <MemberAvatar
                  member={{ id: f.friendId, name: f.name, avatar: f.avatar }}
                  avatarSize={32}
                  withName={false}
                />
                <p className="flex-1 text-sm font-medium text-foreground truncate">
                  {f.name || "User"}
                </p>
                {confirmUnfriend === f.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUnfriend(f.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-400/30 text-red-400 flex items-center justify-center transition-all active:scale-90"
                      title="Confirm unfriend"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmUnfriend(null)}
                      className="w-7 h-7 rounded-lg bg-[#1D2128] border border-border text-muted-foreground flex items-center justify-center hover:text-foreground transition-all active:scale-90"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/friend:opacity-100">
                    <button
                      onClick={() => handleStartFriendChat(f)}
                      disabled={callingFriendId === f.friendId}
                      className="w-7 h-7 rounded-lg bg-transparent border border-transparent hover:border-[#7F9486]/30 text-muted-foreground/50 hover:text-[#7F9486] flex items-center justify-center transition-all active:scale-90 disabled:opacity-60 disabled:cursor-wait"
                      title={callingFriendId === f.friendId ? "Calling..." : "Chat with friend"}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleUnfriend(f.id)}
                      className="w-7 h-7 rounded-lg bg-transparent border border-transparent hover:border-red-400/30 text-muted-foreground/50 hover:text-red-400 flex items-center justify-center transition-all active:scale-90"
                      title="Unfriend"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Bottom half: Previous Matches ─── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-2 flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Previous Matches
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
              <MessageSquare className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-muted-foreground/50 text-xs text-center">
                Your recent chats will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 py-1">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="group/match w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#1D2128] transition-colors"
                >
                  <MemberAvatar
                    member={{ id: m.partnerId, name: m.name, avatar: m.avatar }}
                    avatarSize={32}
                    withName={false}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.name || "Stranger"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 md:group-hover/match:hidden">
                    {timeAgo(m.chatAt)}
                  </span>
                  <button
                    onClick={() => handleRemoveMatch(m.id)}
                    className="flex w-7 h-7 rounded-lg bg-transparent border border-transparent hover:border-red-400/30 text-muted-foreground/50 hover:text-red-400 items-center justify-center transition-all active:scale-90 shrink-0 md:hidden md:group-hover/match:flex"
                    title="Remove match"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 border-t border-border"
        style={mobile ? { paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" } : undefined}
      >
        <p className="text-[10px] text-muted-foreground/40 text-center">
          Be respectful and follow our chat rules
        </p>
      </div>
    </div>
  );
}
