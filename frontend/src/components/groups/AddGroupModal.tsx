import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import axiosInstance from "../../api/axiosInstance";
import { useSnackbar } from "../../context/SnackbarProvider";
import { useAuthContext } from "../../context/AuthProvider";

const languages = [
  { value: "ENGLISH", label: "English" },
  { value: "HINDI", label: "Hindi" },
  { value: "GUJARATI", label: "Gujarati" },
  { value: "SPANISH", label: "Spanish" },
  { value: "FRENCH", label: "French" },
];

const levels = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "NATIVE", label: "Native" },
];

const memberCounts = [2, 3, 4];

export default function AddGroupModal({
  open,
  handleClose,
}: {
  open: boolean;
  handleClose: () => void;
}) {
  const { user } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const [description, setDescription] = React.useState("Anything");
  const [language, setLanguage] = React.useState("GUJARATI");
  const [level, setLevel] = React.useState("BEGINNER");
  const [maxMembers, setMaxMembers] = React.useState("3");
  const [loading, setLoading] = React.useState(false);

  const handleCreate = async () => {
    if (!description || !language || !level) {
      showSnackbar("Please fill all fields", { severity: "warning" });
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post("/api/groups/create", {
        name: user?.name || "1",
        description,
        language,
        level,
        max_members: Number(maxMembers),
      });

      showSnackbar("Group created successfully!");
      handleClose();

      const roomUrl = `/room/${res.data.group.id}`;
      window.open(roomUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      showSnackbar(err?.response?.data?.message || "Failed to create group", {
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="gradient-text text-2xl">Create a Group</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="group-desc">Description</Label>
            <Input
              id="group-desc"
              placeholder="What will you talk about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 appearance-none cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l.value} value={l.value} className="bg-popover text-foreground">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-members">People</Label>
              <select
                id="max-members"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 appearance-none cursor-pointer"
              >
                {memberCounts.map((n) => (
                  <option key={n} value={n} className="bg-popover text-foreground">
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 appearance-none cursor-pointer"
            >
              {levels.map((l) => (
                <option key={l.value} value={l.value} className="bg-popover text-foreground">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleCreate} disabled={loading} className="mt-2">
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
