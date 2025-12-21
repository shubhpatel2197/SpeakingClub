import React, { createContext, useContext, useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "./SnackbarProvider";
import axios, { AxiosError } from "axios";

export type User = {
  id: string;
  email: string;
  name?: string | null;
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
  const navigate = useNavigate();

  const fetchUser = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/user/me");
      setUser(data?.user || null);
    } catch (err) {
      setUser(null);
      // showSnackbar(err as string, { severity: 'error' })
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    fetchUser();
    // we don't add axiosInstance to deps intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshUser = async () => {
    await fetchUser();
  };

  const signOut = async () => {
    try {
      await axiosInstance.post("/auth/signout");
    } catch (err) {
      // ignore network errors on signout
      // console.error(err)
    } finally {
      setUser(null);
      // optional redirect to signin
      navigate("/signin", { replace: true });
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
