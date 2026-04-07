'use client'

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Sparkles, Video, X, Plus, Globe2, Shield, Zap } from "lucide-react";
import { useAuthContext } from "../../context/AuthProvider";
import axiosInstance from "../../api/axiosInstance";

type GenderFilter = "MALE" | "FEMALE" | "BOTH";

type Props = {
  onStartText: () => void;
};

const DEFAULT_INTERESTS = [
  "Music", "Gaming", "Travel", "Movies", "Fitness",
  "Reading", "Cooking", "Tech", "Art", "Sports",
];

export default function ChatHome({ onStartText }: Props) {
  const { user, refreshUser } = useAuthContext();
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsEnabled, setInterestsEnabled] = useState(true);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("BOTH");
  const [newInterest, setNewInterest] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load user interests on mount
  useEffect(() => {
    if (user?.interests) {
      setInterests(user.interests);
    }
  }, [user?.interests]);

  // Focus input when opened
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const persistInterests = async (updated: string[]) => {
    setInterests(updated);
    try {
      await axiosInstance.patch("/api/profile", { interests: updated });
    } catch {}
  };

  const toggleDefault = (interest: string) => {
    if (interests.includes(interest)) {
      persistInterests(interests.filter((i) => i !== interest));
    } else if (interests.length < 6) {
      persistInterests([...interests, interest]);
    }
  };

  const addCustomInterest = () => {
    const trimmed = newInterest.trim();
    if (!trimmed || interests.length >= 6 || interests.includes(trimmed)) return;
    setNewInterest("");
    setShowInput(false);
    persistInterests([...interests, trimmed]);
  };

  const removeInterest = (interest: string) => {
    persistInterests(interests.filter((i) => i !== interest));
  };

  // Custom interests = those not in the default list
  const customInterests = interests.filter((i) => !DEFAULT_INTERESTS.includes(i));
  const hasGender = !!user?.gender;

  return (
    <div className="relative flex flex-col items-center h-full bg-[#1A1D24] overflow-y-auto">
      {/* Ambient background — subtle grid + radial spotlight */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 45% at 50% 0%, rgba(217,122,92,0.16), transparent 70%),
            linear-gradient(rgba(127,148,134,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(127,148,134,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 42px 42px, 42px 42px",
          backgroundPosition: "0 0, 0 0, 0 0",
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]/80 backdrop-blur">
        <span className="text-foreground font-semibold text-sm">New Chat</span>
      </div>

      {/* Hero / Branding */}
      <div className="relative z-10 flex flex-col items-center pt-10 pb-5 px-4">
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-2xl bg-[#7F9486]/40 blur-2xl animate-[heroGlow_3s_ease-in-out_infinite]" />
          <div className="relative w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[#8ea393] via-[#7F9486] to-[#5f7367] flex items-center justify-center shadow-2xl shadow-[#7F9486]/30 border border-white/10">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-foreground font-bold text-[26px] tracking-tight">
          Speaking<span className="text-[#7F9486]">Club</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Meet someone new. Right now.</p>

        {/* Feature chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D2128]/80 border border-border text-[11px] text-muted-foreground">
            <Globe2 className="w-3 h-3 text-[#7F9486]" /> Worldwide
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D2128]/80 border border-border text-[11px] text-muted-foreground">
            <Zap className="w-3 h-3 text-[#7F9486]" /> Instant match
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D2128]/80 border border-border text-[11px] text-muted-foreground">
            <Shield className="w-3 h-3 text-[#7F9486]" /> Anonymous
          </span>
        </div>
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-xl px-4 pb-8">
        <div className="relative rounded-2xl border border-border/80 bg-gradient-to-b from-[#1F242C] to-[#1A1D24] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/20 backdrop-blur">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#7F9486]/40 to-transparent" />

          {/* Interests section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#7F9486]" />
                <span className="text-foreground font-semibold text-sm">Your Interests</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    interestsEnabled
                      ? "text-emerald-400 bg-emerald-400/10"
                      : "text-muted-foreground bg-muted-foreground/10"
                  }`}
                >
                  {interestsEnabled ? "ON" : "OFF"}
                </span>
              </div>
              <button
                onClick={() => setInterestsEnabled(!interestsEnabled)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {interestsEnabled ? "Disable" : "Enable"}
              </button>
            </div>

            <div className="rounded-xl border border-dashed border-border/60 p-3">
              <div className="flex flex-wrap gap-2">
                {/* Default interest tags */}
                {DEFAULT_INTERESTS.map((interest) => {
                  const selected = interests.includes(interest);
                  const atMax = interests.length >= 6 && !selected;
                  return (
                    <button
                      key={interest}
                      onClick={() => toggleDefault(interest)}
                      disabled={atMax}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? "bg-[#7F9486] text-white"
                          : atMax
                            ? "bg-[#1A1D24] text-muted-foreground/30 border border-border cursor-not-allowed"
                            : "bg-[#1A1D24] text-muted-foreground border border-border hover:border-[#7F9486]/40 hover:text-foreground"
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}

                {/* Custom interests inline with defaults */}
                {customInterests.map((interest) => (
                  <span
                    key={interest}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7F9486] text-white"
                  >
                    {interest}
                    <button
                      onClick={() => removeInterest(interest)}
                      className="hover:bg-white/20 rounded p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {/* Add custom interest */}
                {interests.length < 6 && (
                  showInput ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addCustomInterest();
                      }}
                      className="inline-flex items-center gap-1.5"
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        onBlur={() => {
                          if (!newInterest.trim()) setShowInput(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setNewInterest("");
                            setShowInput(false);
                          }
                        }}
                        placeholder="Type..."
                        maxLength={20}
                        className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-[#1A1D24] border border-[#7F9486]/40 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#7F9486] transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!newInterest.trim()}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium bg-[#7F9486] text-white hover:bg-[#6d8275] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowInput(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1A1D24] text-muted-foreground border border-dashed border-border hover:border-[#7F9486]/40 hover:text-foreground transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  )
                )}
              </div>

              <p className="text-muted-foreground/50 text-xs mt-2">
                Select or add up to 6 interests for better matches.
              </p>
              {interests.length >= 6 && (
                <p className="text-muted-foreground/40 text-[10px] mt-2">
                  Maximum 6 interests. Remove one to add another.
                </p>
              )}
            </div>
          </div>

          {/* Gender filter — only show if not already set */}
          {!hasGender && (
            <div>
              <p className="text-foreground font-semibold text-sm mb-3">Gender Filter:</p>
              <div className="flex gap-2 justify-center">
                {(["MALE", "BOTH", "FEMALE"] as GenderFilter[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border text-xs font-medium transition-all ${
                      genderFilter === g
                        ? "border-[#7F9486] bg-[#7F9486]/10 text-[#7F9486]"
                        : "border-border bg-[#1A1D24] text-muted-foreground hover:border-[#7F9486]/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-lg">
                      {g === "MALE" ? "\u2642" : g === "FEMALE" ? "\u2640" : "\u26A4"}
                    </span>
                    {g === "BOTH" ? "Both" : g === "MALE" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              title="Video chat"
              className="shrink-0 w-14 h-14 rounded-xl bg-[#7F9486]/10 border border-[#7F9486]/30 flex items-center justify-center text-[#7F9486] hover:bg-[#7F9486]/20 hover:border-[#7F9486]/60 transition-all active:scale-95"
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              onClick={onStartText}
              className="group relative flex-1 h-14 rounded-xl text-sm font-bold uppercase tracking-[0.12em] text-white overflow-hidden transition-all active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-gradient-to-b from-[#8ea393] to-[#5f7367] group-hover:from-[#7F9486] group-hover:to-[#536a5e] transition-colors" />
              <span className="relative inline-flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Start Text Chat
              </span>
            </button>
          </div>

          <p className="text-center text-muted-foreground/50 text-[11px]">
            Be respectful and follow our chat rules
          </p>
        </div>
      </div>

      <style>{`
        @keyframes heroGlow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.9;  transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
