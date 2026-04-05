'use client'

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Sparkles, Video, X, Plus } from "lucide-react";
import { Button } from "../ui/button";
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
    <div className="flex flex-col items-center h-full bg-[#1A1D24] overflow-y-auto">
      {/* Top bar */}
      <div className="w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
        <span className="text-foreground font-semibold text-sm">New Chat</span>
      </div>

      {/* Branding area */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#7F9486] flex items-center justify-center mb-4 shadow-lg shadow-[#7F9486]/15">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-foreground font-bold text-2xl tracking-tight">
          Speaking<span className="text-[#7F9486]">Club</span>
        </h1>
      </div>

      {/* Main card */}
      <div className="w-full max-w-xl px-4 pb-8">
        <div className="rounded-2xl border border-border bg-[#1D2128] p-5 sm:p-6 space-y-5">

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

              {interests.length === 0 && !showInput && (
                <p className="text-muted-foreground/50 text-xs mt-2">
                  Select or add up to 6 interests for better matches.
                </p>
              )}
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
            <button className="shrink-0 w-12 h-12 rounded-xl bg-[#7F9486]/15 border border-[#7F9486]/30 flex items-center justify-center text-[#7F9486] hover:bg-[#7F9486]/25 transition-all active:scale-95">
              <Video className="w-5 h-5" />
            </button>
            <Button
              onClick={onStartText}
              className="flex-1 h-12 rounded-xl text-sm font-semibold gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Start Text Chat
            </Button>
          </div>

          <p className="text-center text-muted-foreground/40 text-[11px]">
            Be respectful and follow our chat rules
          </p>
        </div>
      </div>
    </div>
  );
}
