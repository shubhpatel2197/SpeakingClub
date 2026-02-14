import * as React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import axiosInstance from "../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthProvider";
import { useSnackbar } from "../../context/SnackbarProvider";

export default function SignIn() {
  const { showSnackbar } = useSnackbar();
  const { refreshUser } = useAuthContext();
  const navigate = useNavigate();
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isValid = validateInputs();
    if (!isValid) return;

    const form = new FormData(event.currentTarget);
    const email = (form.get("email") as string) || "";
    const password = (form.get("password") as string) || "";

    try {
      await axiosInstance.post("/api/auth/signin", { email, password });
      showSnackbar("Signed in successfully!");
      await refreshUser();
      navigate("/", { replace: true });
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
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="p-0 mb-6">
          <CardTitle className="text-3xl font-display gradient-text">Sign in</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
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
                autoComplete="current-password"
                required
                className={passwordError ? "border-destructive focus:ring-destructive/50" : ""}
              />
              {passwordError && (
                <p className="text-xs text-destructive mt-1">{passwordErrorMessage}</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2">
              Sign in
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a
                href="/signup"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign up
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
