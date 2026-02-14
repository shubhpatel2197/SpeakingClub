import * as React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import axiosInstance from "../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthProvider";
import { useSnackbar } from "../../context/SnackbarProvider";

export default function SignUp() {
  const { showSnackbar } = useSnackbar();
  const { refreshUser } = useAuthContext();
  const navigate = useNavigate();
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");
  const [nameError, setNameError] = React.useState(false);
  const [nameErrorMessage, setNameErrorMessage] = React.useState("");

  const validateInputs = () => {
    const email = document.getElementById("email") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    const name = document.getElementById("name") as HTMLInputElement;
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

    if (!name.value || name.value.length < 1) {
      setNameError(true);
      setNameErrorMessage("Name is required.");
      isValid = false;
    } else {
      setNameError(false);
      setNameErrorMessage("");
    }

    return isValid;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const name = form.get("name") as string;
    let email = form.get("email") as string;
    email = email.trim().toLowerCase();
    const password = form.get("password") as string;
    const isValid = validateInputs();

    if (!isValid) return;

    try {
      await axiosInstance.post("/api/auth/signup", {
        name,
        email,
        password,
      });

      showSnackbar("Signed up successfully! Please sign in.");
      await refreshUser();
      navigate("/", { replace: true });
    } catch (error: any) {
      if (error.response) {
        showSnackbar(error.response.data?.error || "Signup failed", {
          severity: "error",
        });
      } else {
        showSnackbar("Network error", { severity: "error" });
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="p-0 mb-6">
          <CardTitle className="text-3xl font-display gradient-text">Sign up</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Jon Snow"
                autoComplete="name"
                required
                className={nameError ? "border-destructive focus:ring-destructive/50" : ""}
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1">{nameErrorMessage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="your@email.com"
                autoComplete="email"
                required
                className={emailError ? "border-destructive focus:ring-destructive/50" : ""}
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
                placeholder="••••••"
                autoComplete="new-password"
                required
                className={passwordError ? "border-destructive focus:ring-destructive/50" : ""}
              />
              {passwordError && (
                <p className="text-xs text-destructive mt-1">{passwordErrorMessage}</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" onClick={validateInputs}>
              Sign up
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <a
                href="/signin"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign in
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
