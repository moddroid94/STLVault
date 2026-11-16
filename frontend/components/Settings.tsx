import React, { useState, useEffect } from "react";
import { ChevronLeft, EthernetPort, KeyRound, Wrench } from "lucide-react";
import {
  api,
  ALL_SLICER_TYPES,
  getEnabledLaunchSlicers,
  setEnabledLaunchSlicers,
  SLICERS,
  SlicerType,
} from "../services/api";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [makerWorldTokenConfigured, setMakerWorldTokenConfigured] =
    useState(false);
  const [makerWorldToken, setMakerWorldToken] = useState("");
  const [makerWorldTokenStatus, setMakerWorldTokenStatus] = useState<
    "idle" | "saved" | "cleared" | "error"
  >("idle");
  const [launchSlicers, setLaunchSlicers] = useState<SlicerType[]>(() =>
    getEnabledLaunchSlicers(),
  );

  const [selectedApiPort, setSelectedApiPort] = useState<string>(() => {
    const envport = import.meta.env.VITE_API_URL as string | undefined;
    const port = localStorage.getItem("api-port-override");
    return port ? port : (envport ?? "");
  });
  const [apiPortStatus, setApiPortStatus] = useState<boolean>(
    () => !!localStorage.getItem("api-port-override"),
  );

  const handleSlicerChange = (
    _event: React.MouseEvent<HTMLElement>,
    value: SlicerType[] | null,
  ) => {
    if (!value || value.length === 0) return;
    setLaunchSlicers(value);
    setEnabledLaunchSlicers(value);
  };

  useEffect(() => {
    api
      .getMakerWorldTokenStatus()
      .then((status) => setMakerWorldTokenConfigured(status.configured))
      .catch(() => setMakerWorldTokenStatus("error"));
  }, []);

  const handleMakerWorldTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!makerWorldToken.trim()) return;

    try {
      const status = await api.updateMakerWorldToken(makerWorldToken.trim());
      setMakerWorldTokenConfigured(status.configured);
      setMakerWorldToken("");
      setMakerWorldTokenStatus("saved");
    } catch {
      setMakerWorldTokenStatus("error");
    }
  };

  const handleMakerWorldTokenClear = async () => {
    try {
      const status = await api.clearMakerWorldToken();
      setMakerWorldTokenConfigured(status.configured);
      setMakerWorldToken("");
      setMakerWorldTokenStatus("cleared");
    } catch {
      setMakerWorldTokenStatus("error");
    }
  };

  const handleApiPortChange = (port: string) => {
    setSelectedApiPort(port);
    setApiPortStatus(false);
  };

  const handleApiForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApiPort) return;
    localStorage.setItem("api-port-override", selectedApiPort);
    setApiPortStatus(true);
  };

  return (
    <Box sx={{ flex: 1, p: { xs: 2, sm: 4 }, height: "100%", overflowY: "auto" }}>
      <Container maxWidth="md" disableGutters>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <IconButton aria-label="Go back" onClick={onBack} edge="start">
            <ChevronLeft />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure your STL Vault preferences
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={4}>
          {/* Slicer Settings */}
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Wrench size={20} />
                  <Typography variant="h6">Default slicer(s)</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Choose which slicer applications to offer when clicking “Open in Slicer”.
                  You can enable more than one.
                </Typography>

                <ToggleButtonGroup
                  value={launchSlicers}
                  onChange={handleSlicerChange}
                  aria-label="Enabled slicers"
                  color="primary"
                  sx={{ flexWrap: "wrap", gap: 1 }}
                >
                  {ALL_SLICER_TYPES.map((slicer) => (
                    <ToggleButton
                      key={slicer}
                      value={slicer}
                      sx={{ textTransform: "none", borderRadius: 2, px: 2 }}
                    >
                      <Stack alignItems="flex-start" spacing={0.25}>
                        <Typography variant="body2" fontWeight={600}>
                          {SLICERS[slicer].name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {SLICERS[slicer].protocol}
                        </Typography>
                      </Stack>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                <Alert severity="info" variant="outlined">
                  Your slicer must be installed and configured to handle the protocol links shown
                  above (setup varies by slicer and OS).
                </Alert>
              </Stack>
            </CardContent>
          </Card>

          {/* MakerWorld Settings */}
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <KeyRound size={20} />
                  <Typography variant="h6">MakerWorld</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Add a Bambu Cloud token to enable MakerWorld 3MF downloads.
                </Typography>
                <Box component="form" onSubmit={handleMakerWorldTokenSubmit}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems={{ sm: "flex-start" }}
                  >
                    <TextField
                      fullWidth
                      type="password"
                      size="small"
                      label="MakerWorld token"
                      placeholder={
                        makerWorldTokenConfigured
                          ? "Token set — paste a new token to replace it"
                          : "Paste token"
                      }
                      value={makerWorldToken}
                      onChange={(e) => {
                        setMakerWorldToken(e.target.value);
                        setMakerWorldTokenStatus("idle");
                      }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!makerWorldToken.trim()}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      Save token
                    </Button>
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
                  <Chip
                    size="small"
                    color={makerWorldTokenConfigured ? "success" : "warning"}
                    label={makerWorldTokenConfigured ? "Token configured" : "Token not configured"}
                    variant="outlined"
                  />
                  {makerWorldTokenConfigured && (
                    <Button size="small" color="inherit" onClick={handleMakerWorldTokenClear}>
                      Clear token
                    </Button>
                  )}
                  {makerWorldTokenStatus === "saved" && (
                    <Typography variant="caption" color="success.main">
                      Saved
                    </Typography>
                  )}
                  {makerWorldTokenStatus === "cleared" && (
                    <Typography variant="caption" color="warning.main">
                      Cleared
                    </Typography>
                  )}
                  {makerWorldTokenStatus === "error" && (
                    <Typography variant="caption" color="error.main">
                      Update failed
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* API Settings */}
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EthernetPort size={20} />
                  <Typography variant="h6">API host</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Override the API base URL used by the app (stored locally in your browser).
                </Typography>
                <Alert severity="info" variant="outlined">
                  This overrides the value from environment variables for this browser.
                </Alert>
                <Box component="form" onSubmit={handleApiForm}>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="API URL"
                      placeholder="http://0.0.0.0:8989"
                      value={selectedApiPort}
                      onChange={(e) => handleApiPortChange(e.target.value)}
                      helperText="Enter the full URL where the API is served."
                    />
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button type="submit" variant="contained" disabled={!selectedApiPort}>
                        Save API URL
                      </Button>
                      <Chip
                        size="small"
                        color={apiPortStatus ? "success" : "error"}
                        label={apiPortStatus ? "Override set" : "Using default / not set"}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
};

export default Settings;
