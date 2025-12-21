import React from "react";
import {
  Box,
  Button,
  Modal,
  Backdrop,
  Fade,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Stack,
} from "@mui/material";
import axiosInstance from "../../api/axiosInstance";
import { useSnackbar } from "../../context/SnackbarProvider";
import { useAuthContext } from '../../context/AuthProvider'

const modalStyle = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  borderRadius: 3,
  boxShadow: 24,
  p: 4,
  outline: "none",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

export default function AddGroupModal({
  open,
  handleClose,
}: {
  open: boolean;
  handleClose: () => void;
}) {
  const {user} = useAuthContext();
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
      const res = await axiosInstance.post("/api/groups", {
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
      // setDescription("");
      // setLanguage("");
      // setLevel("");
      // setMaxMembers("");
    } catch (err: any) {
      console.error(err);
      showSnackbar(err?.response?.data?.message || "Failed to create group", {
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 300 } }}
      sx={{ marginBottom: 30 }}
    >
      <Fade in={open}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Create a Group
          </Typography>

          <TextField
            label="Description"
            variant="outlined"
            rows={3}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Language</InputLabel>
              <Select
                value={language}
                label="Language"
                onChange={(e) => setLanguage(e.target.value)}
              >
                <MenuItem value="ENGLISH">English</MenuItem>
                <MenuItem value="HINDI">Hindi</MenuItem>
                <MenuItem value="GUJARATI">Gujarati</MenuItem>
                <MenuItem value="SPANISH">Spanish</MenuItem>
                <MenuItem value="FRENCH">French</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>No. of people</InputLabel>
              <Select
                value={maxMembers}
                label="No. of people"
                onChange={(e) => setMaxMembers(e.target.value)}
              >
                {[2,3,4].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <FormControl fullWidth>
            <InputLabel>Level</InputLabel>
            <Select
              value={level}
              label="Level"
              onChange={(e) => setLevel(e.target.value)}
            >
              <MenuItem value="BEGINNER">Beginner</MenuItem>
              <MenuItem value="INTERMEDIATE">Intermediate</MenuItem>
              <MenuItem value="ADVANCED">Advanced</MenuItem>
              <MenuItem value="NATIVE">Native</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            onClick={handleCreate}
            disabled={loading}
            sx={{ mt: 1 }}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </Box>
      </Fade>
    </Modal>
  );
}
