'use client'

import React, { createContext, useContext, useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { useRouter } from "next/navigation";
import { useSnackbar } from "./SnackbarProvider";
import { clearAuthToken } from "../lib/authToken";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  interests?: string[];
  agreedToTerms?: boolean;
  createdAt?: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showSnackbar } = useSnackbar();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/api/user/me");
      setUser(data?.user || null);
    } catch (err) {
      clearAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshUser = async () => {
    await fetchUser();
  };

  const signOut = async () => {
    try {
      await axiosInstance.post("/api/auth/signout");
    } catch (err) {
      // ignore network errors on signout
    } finally {
      clearAuthToken();
      setUser(null);
      router.replace("/signin");
    }
  };

  const value: AuthContextValue = {
    user,
    loading,
    refreshUser,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}
