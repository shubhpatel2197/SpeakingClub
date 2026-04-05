'use client'

import { useEffect, useState } from "react";
import { MessageSquare, Users, Plus, UserPlus, Bell, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import MemberAvatar from "../ui/MemberAvatar";
import axiosInstance from "../../api/axiosInstance";

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
  fetchRequests: () => Promise<void>;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
};

type Props = {
  onNewChat: () => void;
  friendReqs: FriendReqsHook;
  matchVersion?: number;
};

export default function ChatSidebar({ onNewChat, friendReqs, matchVersion = 0 }: Props) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => {
    fetchFriends();
    fetchMatches();
  }, []);

  // Re-fetch matches when matchVersion changes (on skip / partner-left)
  useEffect(() => {
    if (matchVersion > 0) fetchMatches();
  }, [matchVersion]);

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
    await friendReqs.accept(requestId);
    fetchFriends();
  };

  const handleReject = async (requestId: string) => {
    await friendReqs.reject(requestId);
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
    <div className="flex flex-col h-full w-full bg-[#1A1D24] border-r border-border">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-base">Chats</h2>
          <Button
            size="sm"
            onClick={onNewChat}
            className="h-8 rounded-xl px-3 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Chat
          </Button>
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
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 animate-pulse">
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
              <button
                key={f.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#1D2128] transition-colors text-left"
              >
                <MemberAvatar
                  member={{ id: f.friendId, name: f.name, avatar: f.avatar }}
                  avatarSize={32}
                  withName={false}
                />
                <p className="flex-1 text-sm font-medium text-foreground truncate">
                  {f.name || "User"}
                </p>
              </button>
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
                <button
                  key={m.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#1D2128] transition-colors text-left"
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
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {timeAgo(m.chatAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border">
        <p className="text-[10px] text-muted-foreground/40 text-center">
          Be respectful and follow our chat rules
        </p>
      </div>
    </div>
  );
}
