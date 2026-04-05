'use client'

import * as React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import axiosInstance from "../../api/axiosInstance";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../../context/AuthProvider";
import { useSnackbar } from "../../context/SnackbarProvider";
import { setAuthToken } from "../../lib/authToken";
import { ArrowRight, CheckCircle2, MessageSquare, Sparkles } from "lucide-react";


export default function SignIn() {
  const { showSnackbar } = useSnackbar();
  const { refreshUser } = useAuthContext();
  const router = useRouter();
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");
  const googleButtonRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const initGoogle = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "filled_black",
          size: "large",
          width: googleButtonRef.current.offsetWidth,
          text: "signin_with",
        });
      }
    };
    // GSI script may load after component mounts
    if (window.google) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleResponse = async (response: any) => {
    try {
      const { data } = await axiosInstance.post("/api/auth/google", {
        credential: response.credential,
      });
      if (data?.token) {
        setAuthToken(data.token);
      }
      showSnackbar("Signed in with Google!");
      await refreshUser();
      router.replace("/");
    } catch (err: any) {
      showSnackbar(err.response?.data?.error || "Google sign-in failed", {
        severity: "error",
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isValid = validateInputs();
    if (!isValid) return;

    const form = new FormData(event.currentTarget);
    const email = ((form.get("email") as string) || "").trim().toLowerCase();
    const password = (form.get("password") as string) || "";

    try {
      const { data } = await axiosInstance.post("/api/auth/signin", { email, password });
      if (data?.token) {
        setAuthToken(data.token);
      }
      showSnackbar("Signed in successfully!");
      await refreshUser();
      router.replace("/");
    } catch (err: any) {
      if (err.response) {
        const message = err.response.data?.error || "Signin failed";
        showSnackbar(message, { severity: "error" });
      } else {
        showSnackbar("Network error", { severity: "error" });
      }
    }
  };

  const validateInputs = () => {
    const email = document.getElementById("email") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    let isValid = true;

    if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage("Please enter a valid email address.");
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage("");
    }

    if (!password.value) {
      setPasswordError(true);
      setPasswordErrorMessage("Password is required.");
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage("");
    }

    return isValid;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-0 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left hero panel */}
        <section className="relative overflow-hidden bg-[#1A1D24] p-6 text-foreground sm:p-8 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,122,92,0.12),transparent_40%)]" />
          <div className="absolute -left-8 top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl motion-safe:animate-float-slow" />
          <div className="absolute right-10 top-24 h-24 w-24 rounded-full bg-[#7F9486]/10 blur-2xl motion-safe:animate-float-delayed" />

          <div className="relative">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase motion-safe:animate-fade-up">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              SpeakingClub
            </div>

            <div className="max-w-lg space-y-4">
              <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl motion-safe:animate-fade-up">
                Serious practice.
                <br />
                Cleaner focus.
              </h1>
              <p className="max-w-md text-base leading-7 text-muted-foreground sm:text-lg motion-safe:animate-fade-up-delayed">
                Small rooms, real conversation, less noise.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:max-w-xl sm:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-border bg-[#1D2128] p-5 motion-safe:animate-fade-up-delayed">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Room ready</p>
                      <p className="text-xs text-muted-foreground">English conversation</p>
                    </div>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-[#7F9486] motion-safe:animate-pulse" />
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-foreground/80">
                    Introductions
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-foreground/70">
                    Travel stories
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                    4 people listening
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-border bg-[#1D2128] p-4 motion-safe:animate-fade-up-late">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#7F9486]" />
                    <p className="text-sm font-medium">Fast re-entry</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-[#1D2128] p-4 motion-safe:animate-float-delayed">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Focused
                  </p>
                  <p className="mt-2 text-2xl font-semibold">1 room</p>
                  <p className="text-sm text-muted-foreground">One clear next step.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right form panel */}
        <div className="w-full bg-[#1D2128] p-6 sm:p-8 lg:p-12">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Welcome back
          </div>
          <h2 className="text-3xl font-semibold text-foreground">
            Sign in
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Continue your practice.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 mt-8">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
                required
                className={emailError ? "border-destructive/70 focus:ring-destructive/20" : ""}
              />
              {emailError && (
                <p className="text-xs text-destructive mt-1">{emailErrorMessage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className={passwordError ? "border-destructive/70 focus:ring-destructive/20" : ""}
              />
              {passwordError && (
                <p className="text-xs text-destructive mt-1">{passwordErrorMessage}</p>
              )}
            </div>

            <Button type="submit" className="mt-2 h-12 w-full rounded-2xl">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#1D2128] px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div ref={googleButtonRef} className="w-full flex justify-center" />

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <a
                href="/signup"
                className="font-semibold text-primary transition-opacity hover:opacity-70"
              >
                Create one
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
