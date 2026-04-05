'use client'

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";

type Props = {
  open: boolean;
  onAgree: (gender: "MALE" | "FEMALE") => void;
};

export default function AgreeModal({ open, onAgree }: Props) {
  const [gender, setGender] = useState<"MALE" | "FEMALE" | null>(null);
  const [agreed, setAgreed] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Before you start...
          </DialogTitle>
          <DialogDescription>
            Select your gender so we can match you with the right people.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {/* Gender select */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">I am:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGender("MALE")}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                  gender === "MALE"
                    ? "border-[#7F9486] bg-[#7F9486]/10 text-[#7F9486]"
                    : "border-border bg-[#1A1D24] text-muted-foreground hover:border-[#7F9486]/50 hover:text-foreground"
                }`}
              >
                <span className="text-lg">♂</span>
                Male
              </button>
              <button
                onClick={() => setGender("FEMALE")}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                  gender === "FEMALE"
                    ? "border-[#7F9486] bg-[#7F9486]/10 text-[#7F9486]"
                    : "border-border bg-[#1A1D24] text-muted-foreground hover:border-[#7F9486]/50 hover:text-foreground"
                }`}
              >
                <span className="text-lg">♀</span>
                Female
              </button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              *You cannot change your gender after you register.
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border bg-[#1A1D24] accent-[#7F9486] cursor-pointer"
            />
            <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              I'm at least{" "}
              <span className="font-semibold text-primary">18 years old</span>{" "}
              and have read and agree to the{" "}
              <span className="font-semibold text-primary cursor-pointer hover:underline">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="font-semibold text-primary cursor-pointer hover:underline">
                Privacy Policy
              </span>
            </span>
          </label>

          {/* Submit */}
          <Button
            disabled={!gender || !agreed}
            onClick={() => gender && onAgree(gender)}
            className="h-12 w-full rounded-2xl text-base font-semibold"
          >
            I agree, let's go!
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
