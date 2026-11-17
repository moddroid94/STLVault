import React, { useState, useCallback, useRef, useEffect } from "react";
import { ModelVersion, STLModel } from "../types";
import Viewer3D from "./Viewer3D";
import {
  X,
  Download,
  Tag as TagIcon,
  Save,
  Edit,
  Trash2,
  Calendar,
  HardDrive,
  FileUp,
  RefreshCw,
  AlertTriangle,
  ScreenShareIcon,
  BookOpen,
  Plus,
  Star,
  Eye,
  Ban,
} from "lucide-react";

import { generateThumbnail } from "../services/thumbnailGenerator";
import {
  api,
  getEnabledLaunchSlicers,
  SLICERS,
  SlicerType,
} from "../services/api";
import { Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import OutlinedInput from "@mui/material/OutlinedInput";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";

interface DetailPanelProps {
  model: STLModel | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<STLModel>) => void;
  onDelete: (id: string) => void;
  onOpenManual: (model: STLModel) => void;
  onEditManual: (model: STLModel) => void;
  onUploadManual: (id: string, file: File) => void | Promise<unknown>;
  onDeleteManual: (id: string) => void | Promise<void>;
  onModelsChanged: () => void | Promise<void>;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  model,
  onClose,
  onUpdate,
  onDelete,
  onOpenManual,
  onEditManual,
  onUploadManual,
  onDeleteManual,
  onModelsChanged,
}) => {
  const [isReplacing, setIsReplacing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [tempThumb, setTempThumb] = useState("");
  const [errorState, setErrorState] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: "" });

  const [slicerAnchorEl, setSlicerAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [enabledSlicers, setEnabledSlicers] = useState<SlicerType[]>(() =>
    getEnabledLaunchSlicers(),
  );

  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [versionBusyId, setVersionBusyId] = useState<string | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionNotes, setNewVersionNotes] = useState("");
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (model) {
      setEditName(model.name);
      setEditDesc(model.description || "");
      setEditTags(model.tags.join(", "));
      setIsEditing(false);
      setIsReplacing(false);
      setTempThumb("");
      setErrorState({ show: false, message: "" });
    }
  }, [model]);

  useEffect(() => {
    const refreshEnabledSlicers = () =>
      setEnabledSlicers(getEnabledLaunchSlicers());
    window.addEventListener("focus", refreshEnabledSlicers);
    window.addEventListener("storage", refreshEnabledSlicers);
    return () => {
      window.removeEventListener("focus", refreshEnabledSlicers);
      window.removeEventListener("storage", refreshEnabledSlicers);
    };
  }, []);

  const modelId = model?.id;
  const loadVersions = useCallback(async () => {
    if (!modelId) return;
    setVersionsLoading(true);
    try {
      setVersions(await api.getModelVersions(modelId));
    } catch (err) {
      console.error("Failed to load version history", err);
    } finally {
      setVersionsLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    setPreviewVersionId(null);
    loadVersions();
  }, [modelId, loadVersions]);

  const handleModelLoaded = useCallback(
    (dimensions: { x: number; y: number; z: number }) => {
      if (model && !model.dimensions) {
        onUpdate(model.id, { dimensions });
      }
    },
    [model, onUpdate],
  );

  if (!model) return null;

  const previewVersion =
    versions.find((version) => version.id === previewVersionId) ||
    versions.find((version) => version.isFinal) ||
    null;
  const previewUrl = previewVersion?.downloadUrl || model.url;
  const previewFilename = previewVersion?.originalName || model.name;
  const previewThumbnail = previewVersion?.thumbnailUrl || model.thumbnail;
  const previewDownloadUrl = previewVersion
    ? api.getVersionDownloadUrl(model.id, previewVersion.id)
    : api.getDownloadUrl(model);

  const openSlicerLauncher = (event: React.MouseEvent<HTMLElement>) => {
    const launchSlicers = getEnabledLaunchSlicers();
    setEnabledSlicers(launchSlicers);
    if (launchSlicers.length === 1) {
      window.location.href = api.getSlicerUrl(
        model,
        launchSlicers[0],
        previewDownloadUrl,
      );
      return;
    }
    setSlicerAnchorEl(event.currentTarget);
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;

    const getExtension = (filename: string) => {
      const parts = filename.split(".");
      return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    };

    const currentExt = getExtension(model.fileName || model.name);
    const newExt = getExtension(file.name);

    if (currentExt && newExt && currentExt !== newExt) {
      setErrorState({
        show: true,
        message: `You cannot replace a .${currentExt} file with a .${newExt} file.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsReplacing(true);
    try {
      let thumb: string | undefined;
      try {
        thumb = await generateThumbnail(file);
      } catch (err) {
        console.warn("Thumbnail failed", err);
      }
      const updated = await api.replaceModelFile(model.id, file, thumb);
      onUpdate(model.id, {
        url: updated.url,
        size: updated.size,
        thumbnail: updated.thumbnail,
      });
      setPreviewVersionId(null);
      await loadVersions();
      await onModelsChanged();
    } catch (e) {
      console.error("Failed to upload revision", e);
      alert("Failed to upload new revision");
    } finally {
      setIsReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReplaceThumbnail = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;

    setIsReplacing(true);
    try {
      const updated = await api.replaceModelThumbnail(model.id, file);
      onUpdate(model.id, {
        url: updated.url,
        size: updated.size,
        thumbnail: updated.thumbnail,
      });
      await loadVersions();
      await onModelsChanged();
    } catch (e) {
      console.error("Failed to replace thumbnail", e);
      alert("Failed to replace thumbnail");
    } finally {
      setIsReplacing(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    }
  };

  const handleGenerateThumbnail = (dataurl: string) => {
    setTempThumb(dataurl);
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;
    try {
      await onUploadManual(model.id, file);
    } finally {
      if (manualInputRef.current) manualInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    const getExtension = (filename: string) => {
      const parts = filename.split(".");
      return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    };

    const currentExt = getExtension(model.name);
    const editExt = getExtension(editName);
    const newName =
      editExt && editExt !== currentExt ? `${editName}.${currentExt}` : editName;

    const newTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tempThumb !== "") {
      onUpdate(model.id, {
        name: newName,
        description: editDesc,
        tags: newTags,
        thumbnail: tempThumb,
      });
    } else {
      onUpdate(model.id, {
        name: newName,
        description: editDesc,
        tags: newTags,
      });
    }

    setIsEditing(false);
  };

  const refreshAfterVersionChange = async () => {
    await loadVersions();
    await onModelsChanged();
  };

  const handleSetFinal = async (version: ModelVersion) => {
    setVersionBusyId(version.id);
    try {
      await api.updateModelVersion(model.id, version.id, { isFinal: true });
      setPreviewVersionId(null);
      await refreshAfterVersionChange();
    } catch (err) {
      console.error("Failed to set final revision", err);
      alert("Failed to set final revision");
    } finally {
      setVersionBusyId(null);
    }
  };

  const handleDeprecateVersion = async (version: ModelVersion) => {
    if (
      !window.confirm(
        `Deprecate revision v${version.versionNumber}? Its file will be removed from disk, but the history entry will be kept.`,
      )
    ) {
      return;
    }
    setVersionBusyId(version.id);
    try {
      await api.deprecateModelVersion(model.id, version.id);
      if (previewVersionId === version.id) setPreviewVersionId(null);
      await refreshAfterVersionChange();
    } catch (err) {
      console.error("Failed to deprecate revision", err);
      alert("Failed to deprecate revision");
    } finally {
      setVersionBusyId(null);
    }
  };

  const handleManualVersionUpload = async () => {
    if (!newVersionFile) return;
    setIsUploadingVersion(true);
    try {
      let thumb: string | undefined;
      try {
        thumb = await generateThumbnail(newVersionFile);
      } catch (err) {
        console.warn("Thumbnail failed", err);
      }
      await api.uploadModelVersion(
        model.id,
        newVersionFile,
        thumb,
        newVersionNotes.trim() || undefined,
      );
      setVersionDialogOpen(false);
      setNewVersionFile(null);
      setNewVersionNotes("");
      setPreviewVersionId(null);
      await refreshAfterVersionChange();
    } catch (err) {
      console.error("Failed to upload revision", err);
      alert("Failed to upload new revision");
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const fileExt = model.name.includes(".")
    ? model.name.split(".").pop()?.toUpperCase()
    : "";

  return (
    <div className="w-screen sm:w-96 border-l border-vault-700 bg-black flex flex-col h-full shadow-2xl z-20 relative">
      {/* Header */}
      <div className="p-4 border-b border-vault-700 flex justify-between items-center gap-2">
        <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
          Model Details
        </Typography>
        <IconButton
          aria-label="Close details"
          onClick={onClose}
          size="small"
          sx={{ border: 1, borderColor: "divider" }}
        >
          <X size={18} />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Stack spacing={3}>
          {/* Preview */}
          <section aria-labelledby="detail-preview-heading" className="space-y-2">
            <Typography id="detail-preview-heading" variant="overline" color="text.secondary">
              Preview
            </Typography>
            <div className="-mx-4 sm:mx-0 aspect-square bg-black overflow-hidden sm:rounded-lg border-y sm:border border-vault-700 shadow-inner">
              <Viewer3D
                url={previewUrl}
                filename={previewFilename}
                thumbnail={previewThumbnail}
                editing={isEditing}
                onMakeThumbnail={handleGenerateThumbnail}
                onLoaded={handleModelLoaded}
              />
            </div>
            {previewVersion && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary">
                  Viewing revision v{previewVersion.versionNumber}
                  {previewVersion.isFinal ? " (final)" : ""}
                </Typography>
                {previewVersionId && (
                  <Button size="small" onClick={() => setPreviewVersionId(null)}>
                    Back to final
                  </Button>
                )}
              </Stack>
            )}
          </section>

          {/* Primary actions */}
          <section aria-labelledby="detail-actions-heading" className="space-y-2">
            <Typography id="detail-actions-heading" variant="overline" color="text.secondary">
              Actions
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                href={previewDownloadUrl}
                download={previewFilename}
                variant="contained"
                startIcon={<Download size={18} />}
              >
                Download
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ScreenShareIcon size={18} />}
                onClick={openSlicerLauncher}
              >
                <Typography noWrap variant="button" sx={{ textTransform: "none" }}>
                  Open in slicer
                </Typography>
              </Button>
            </Stack>
            <Menu
              anchorEl={slicerAnchorEl}
              open={Boolean(slicerAnchorEl)}
              onClose={() => setSlicerAnchorEl(null)}
            >
              {enabledSlicers.map((slicer) => (
                <MenuItem
                  key={slicer}
                  onClick={() => {
                    window.location.href = api.getSlicerUrl(
                      model,
                      slicer,
                      previewDownloadUrl,
                    );
                    setSlicerAnchorEl(null);
                  }}
                >
                  {SLICERS[slicer].name}
                </MenuItem>
              ))}
            </Menu>
          </section>

          <Divider />

          {/* Details */}
          <section aria-labelledby="detail-info-heading" className="space-y-4">
            <Typography id="detail-info-heading" variant="overline" color="text.secondary">
              Details
            </Typography>

            <div className="space-y-1.5">
              <Typography variant="subtitle2">Name</Typography>
              {isEditing ? (
                <OutlinedInput
                  fullWidth
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                  {model.name}
                </Typography>
              )}
            </div>

            <div className="space-y-1">
              <Typography variant="subtitle2">File ID</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {model.id}
                {fileExt ? `.${fileExt.toLowerCase()}` : ""}
              </Typography>
            </div>

            <div className="space-y-1.5">
              <Typography variant="subtitle2">Description</Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Add a description..."
                  multiline
                  minRows={3}
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                  {model.description || "No description"}
                </Typography>
              )}
            </div>

            <div className="space-y-2">
              <Typography variant="subtitle2">Manual</Typography>
              {isEditing ? (
                model.manual ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {model.manual}
                    </Typography>
                    <Tooltip title="Edit manual">
                      <IconButton size="small" onClick={() => onEditManual(model)} aria-label="edit manual">
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete manual">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDeleteManual(model.id)}
                        aria-label="delete manual"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      component="label"
                      variant="contained"
                      size="small"
                      startIcon={<FileUp size={16} />}
                    >
                      Upload manual
                      <input
                        type="file"
                        ref={manualInputRef}
                        className="hidden"
                        accept=".md,.markdown,text/markdown"
                        onChange={handleManualUpload}
                      />
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit size={16} />}
                      onClick={() => onEditManual(model)}
                    >
                      Paste text
                    </Button>
                  </Stack>
                )
              ) : model.manual ? (
                <Button
                  fullWidth
                  onClick={() => onOpenManual(model)}
                  variant="outlined"
                  startIcon={<BookOpen size={18} />}
                >
                  Open manual
                </Button>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No manual attached
                </Typography>
              )}
            </div>
          </section>

          <Divider />

          {/* Metadata */}
          <section aria-labelledby="detail-meta-heading" className="space-y-3">
            <Typography id="detail-meta-heading" variant="overline" color="text.secondary">
              Metadata
            </Typography>

            <div className="space-y-2">
              <Typography variant="subtitle2">Tags</Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="scifi, armor, character..."
                  multiline
                  minRows={2}
                  size="small"
                />
              ) : (
                <Grid container spacing={0.75} columns={12}>
                  {model.tags.length > 0 ? (
                    model.tags.map((tag) => (
                      <Grid
                        key={tag}
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                        size="auto"
                      >
                        <Chip
                          size="small"
                          label={tag}
                          icon={<TagIcon size={14} className="ml-1" />}
                        />
                      </Grid>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", pl: 0.5 }}>
                      No tags
                    </Typography>
                  )}
                </Grid>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-vault-700/50 p-3">
              <Stack direction="row" spacing={1} alignItems="center">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <Typography variant="caption" color="text.secondary" display="block">
                    Added
                  </Typography>
                  <Typography variant="body2">{new Date(model.dateAdded).toLocaleDateString()}</Typography>
                </div>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <HardDrive size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <Typography variant="caption" color="text.secondary" display="block">
                    Size
                  </Typography>
                  <Typography variant="body2">{(model.size / (1024 * 1024)).toFixed(2)} MB</Typography>
                </div>
              </Stack>
            </div>
          </section>

          <Divider />

          {/* Version history */}
          <section aria-labelledby="detail-history-heading" className="space-y-3">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography id="detail-history-heading" variant="overline" color="text.secondary">
                Version history
              </Typography>
              <Button
                size="small"
                startIcon={<Plus size={16} />}
                onClick={() => setVersionDialogOpen(true)}
              >
                Add version
              </Button>
            </Stack>

            {versionsLoading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={24} />
              </Box>
            ) : versions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No revisions recorded yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {versions.map((version) => (
                  <Box
                    key={version.id}
                    className="rounded-lg border border-vault-700/50 p-3 space-y-2"
                    sx={{
                      borderColor:
                        previewVersion?.id === version.id ? "primary.main" : undefined,
                      opacity: version.isDeprecated ? 0.65 : 1,
                    }}
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle2">v{version.versionNumber}</Typography>
                      {version.isFinal && (
                        <Chip size="small" color="success" label="Final" icon={<Star size={12} />} />
                      )}
                      {version.isDeprecated && (
                        <Chip size="small" label="Deprecated" icon={<Ban size={12} />} />
                      )}
                      <Box flex={1} />
                      {!version.isDeprecated && (
                        <Tooltip title="Preview this revision">
                          <IconButton
                            size="small"
                            onClick={() => setPreviewVersionId(version.id)}
                            aria-label={`Preview revision ${version.versionNumber}`}
                          >
                            <Eye size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: "break-word" }}>
                      {version.originalName} · {new Date(version.dateAdded).toLocaleDateString()} ·{" "}
                      {(version.size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                    {version.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                        {version.notes}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {!version.isFinal && !version.isDeprecated && (
                        <Button
                          size="small"
                          disabled={versionBusyId === version.id}
                          onClick={() => handleSetFinal(version)}
                        >
                          Set final
                        </Button>
                      )}
                      <Button
                        size="small"
                        color="error"
                        disabled={
                          versionBusyId === version.id ||
                          version.isDeprecated ||
                          version.isFinal
                        }
                        onClick={() => handleDeprecateVersion(version)}
                      >
                        Deprecate
                      </Button>
                      {!version.isDeprecated && (
                        <Button
                          size="small"
                          href={api.getVersionDownloadUrl(model.id, version.id)}
                          download={version.originalName}
                          startIcon={<Download size={14} />}
                        >
                          Download
                        </Button>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </section>

          {/* File editing (edit mode) */}
          {isEditing && (
            <>
              <Divider />
              <section aria-labelledby="detail-files-heading" className="space-y-3">
                <Typography id="detail-files-heading" variant="overline" color="text.secondary">
                  File editing
                </Typography>

                <div className="space-y-1.5">
                  <Typography variant="subtitle2">3D model file</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {model.fileName || model.name}
                  </Typography>
                  <Button
                    fullWidth
                    disabled={isReplacing}
                    component="label"
                    variant="contained"
                    startIcon={!isReplacing ? <FileUp size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                  >
                    {isReplacing ? "Uploading…" : "Upload new revision"}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".stl,.step,.stp,.3mf"
                      onChange={handleReplaceFile}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    The previous file is kept in version history and stays available.
                  </Typography>
                </div>

                <div className="space-y-2">
                  <Typography variant="subtitle2">Thumbnail</Typography>
                  <div className="flex justify-center">
                    <img
                      className="h-48 w-48 sm:h-56 sm:w-56 object-cover rounded-lg border border-vault-700"
                      src={tempThumb !== "" ? tempThumb : model.thumbnail}
                      alt="Thumbnail preview"
                    />
                  </div>
                  <Stack spacing={1}>
                    <Button
                      disabled={isReplacing}
                      component="label"
                      variant="contained"
                      startIcon={!isReplacing ? <FileUp size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                    >
                      {isReplacing ? "Uploading…" : "Replace thumbnail"}
                      <input
                        type="file"
                        ref={thumbnailInputRef}
                        className="hidden"
                        accept=".jpeg,.png,.jpg"
                        onChange={handleReplaceThumbnail}
                      />
                    </Button>
                    <Button
                      disabled={isReplacing}
                      onClick={() => setTempThumb("")}
                      variant="outlined"
                      color="warning"
                      startIcon={<X size={18} />}
                    >
                      Clear generated thumbnail
                    </Button>
                  </Stack>
                </div>
              </section>
            </>
          )}

          {/* Edit controls */}
          {isEditing ? (
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                onClick={handleSave}
                startIcon={<Save size={18} />}
                variant="contained"
                color="success"
              >
                Save changes
              </Button>
              <Button fullWidth onClick={() => setIsEditing(false)} variant="outlined">
                Cancel
              </Button>
            </Stack>
          ) : (
            <Button
              fullWidth
              onClick={() => setIsEditing(true)}
              variant="outlined"
              endIcon={<Edit size={18} />}
            >
              Edit model
            </Button>
          )}

          <Divider />

          {/* Danger zone */}
          <section aria-labelledby="detail-danger-heading" className="space-y-3 pb-2">
            <Typography id="detail-danger-heading" variant="overline" color="error">
              Danger zone
            </Typography>
            <Button
              fullWidth
              onClick={() => onDelete(model.id)}
              endIcon={<Trash2 size={18} />}
              color="error"
              variant="contained"
            >
              Delete model
            </Button>
          </section>
        </Stack>
      </div>

      {/* Error Modal Overlay */}
      {errorState.show && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-6 animate-in fade-in duration-200">
          <div className="bg-vault-800 border border-red-500/50 rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <Typography variant="subtitle1" component="h3" fontWeight="bold">
                  File mismatch
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
                  {errorState.message}
                </Typography>
              </div>
              <Button
                fullWidth
                onClick={() => setErrorState({ show: false, message: "" })}
                variant="outlined"
              >
                Okay, got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add manual revision */}
      <Dialog
        open={versionDialogOpen}
        onClose={() => setVersionDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add new revision</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Upload a file to create the next numbered revision. It becomes the
            final revision; previous files stay in the history.
          </DialogContentText>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button component="label" variant="outlined" startIcon={<FileUp size={18} />}>
              {newVersionFile ? newVersionFile.name : "Choose file"}
              <input
                type="file"
                className="hidden"
                accept=".stl,.step,.stp,.3mf"
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
              />
            </Button>
            <TextField
              fullWidth
              label="Revision notes"
              value={newVersionNotes}
              onChange={(e) => setNewVersionNotes(e.target.value)}
              placeholder="What changed in this revision?"
              multiline
              minRows={2}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleManualVersionUpload}
            disabled={!newVersionFile || isUploadingVersion}
            variant="contained"
            startIcon={isUploadingVersion ? <CircularProgress size={16} /> : <Plus size={16} />}
          >
            {isUploadingVersion ? "Uploading…" : "Add revision"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default DetailPanel;
