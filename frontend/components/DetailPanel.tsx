import React, { useState, useCallback, useRef } from "react";
import { STLModel } from "../types";
import Viewer3D from "./Viewer3D";
import {
  X,
  Download,
  Tag as TagIcon,
  Sparkles,
  Save,
  Edit,
  Trash2,
  Calendar,
  HardDrive,
  FileUp,
  RefreshCw,
  AlertTriangle,
  ScreenShareIcon,
} from "lucide-react";

import { generateThumbnail } from "../services/thumbnailGenerator";
import { api } from "../services/api";
import { Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import OutlinedInput from "@mui/material/OutlinedInput";
import TextField from "@mui/material/TextField";
import Badge from "@mui/material/Badge";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";

interface DetailPanelProps {
  model: STLModel | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<STLModel>) => void;
  onDelete: (id: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  model,
  onClose,
  onUpdate,
  onDelete,
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset local state when model changes
  React.useEffect(() => {
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

  const handleModelLoaded = useCallback(
    (dimensions: { x: number; y: number; z: number }) => {
      if (model && !model.dimensions) {
        onUpdate(model.id, { dimensions });
      }
    },
    [model, onUpdate],
  );

  if (!model) return null;

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;

    // Extension check
    const getExtension = (filename: string) => {
      const parts = filename.split(".");
      return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    };

    const currentExt = getExtension(model.name);
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
      // Generate thumbnail
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
      // Note: The name and other metadata are preserved unless the user explicitly changes them in the text fields
    } catch (e) {
      console.error("Failed to replace", e);
      alert("Failed to replace file");
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
      // Note: The name and other metadata are preserved unless the user explicitly changes them in the text fields
    } catch (e) {
      console.error("Failed to replace", e);
      alert("Failed to replace file");
    } finally {
      setIsReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerateThumbnail = (dataurl: string) => {
    setTempThumb(dataurl);
  };

  const handleSave = () => {
    const getExtension = (filename: string) => {
      const parts = filename.split(".");
      return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    };

    const currentExt = getExtension(model.name);
    const editExt = getExtension(editName);
    let newName = "";
    if (editExt != currentExt) {
      newName = editName + "." + currentExt;
    } else {
      newName = editName;
    }

    const newTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tempThumb != "") {
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

  return (
    <div className="w-screen sm:w-96 border-l border-vault-700 bg-black flex flex-col h-full shadow-2xl z-20 relative">
      {/* Header */}

      <div className="p-4 border-b border-vault-700 flex justify-between items-center">
        <Typography variant="h6">Model Details</Typography>
        <Button onClick={onClose} variant="outlined" color="primary">
          <X />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Viewer */}
        <div className="-m-4 aspect-square bg-black overflow-hidden shadow-inner -mb-2">
          <Viewer3D
            url={model.url}
            filename={model.name}
            thumbnail={model.thumbnail}
            editing={isEditing}
            onMakeThumbnail={handleGenerateThumbnail}
            onLoaded={handleModelLoaded}
          />
        </div>

        {/* Actions */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <Button
            fullWidth
            href={api.getDownloadUrl(model)}
            download={model.name}
            variant="contained"
            startIcon={<Download />}
          >
            Download
          </Button>

          <Button
            fullWidth
            href={api.getSlicerUrl(model)}
            variant="outlined"
            startIcon={<ScreenShareIcon />}
          >
            <Typography noWrap variant="subtitle2">
              Open in Slicer
            </Typography>
          </Button>
        </Stack>

        {/* Info Form */}
        <div className="space-y-4">
          <div>
            <Typography variant="h6" gutterBottom>
              Name
            </Typography>
            {isEditing ? (
              <OutlinedInput
                fullWidth
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            ) : (
              <Typography variant="body1" sx={{ color: "text.secondary" }}>
                {model.name}
              </Typography>
            )}
          </div>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Filename: <br></br>
            {model.id}.{model.name.split(".").pop()}
          </Typography>
          <Divider />
          <div>
            <Typography variant="body1" gutterBottom>
              Description
            </Typography>

            {isEditing ? (
              <TextField
                fullWidth
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Add a description..."
                multiline
              />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {model.description || "No Description"}
              </Typography>
            )}
          </div>
          <Divider />

          <Typography variant="subtitle1">Metadata</Typography>

          <div className="space-y-3">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-md border border-vault-700/50 -mt-2">
              <div className="col-span-2">
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Tags:
                  </Typography>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="scifi, armor, character..."
                      multiline
                    />
                  ) : (
                    <Grid container spacing={1} columns={12}>
                      {model.tags.length > 0 ? (
                        model.tags.map((tag) => (
                          <Grid
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            size="auto"
                          >
                            <Chip
                              size="small"
                              key={tag}
                              label={tag}
                              icon={<TagIcon className="w-4 pl-1" />}
                            ></Chip>
                          </Grid>
                        ))
                      ) : (
                        <span className="text-slate-600 italic text-sm">
                          No tags
                        </span>
                      )}
                    </Grid>
                  )}
                </Stack>
              </div>
              <Divider className="col-span-2" />

              <div className="space-y-1">
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "baseline",
                    minWidth: 0,
                  }}
                >
                  <Calendar className="w-3 h-3" />
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Added:
                  </Typography>
                  <Typography variant="caption">
                    {new Date(model.dateAdded).toLocaleDateString()}
                  </Typography>
                </Stack>
              </div>
              <div className="space-y-1">
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "baseline",
                    minWidth: 0,
                  }}
                >
                  <HardDrive className="w-3 h-3" />
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    File Size:
                  </Typography>
                  <Typography variant="caption">
                    {(model.size / (1024 * 1024)).toFixed(2)} MB
                  </Typography>
                </Stack>
              </div>
            </div>
            <Divider />

            {/* File Replacement Section (Edit Mode Only) */}
            {isEditing && (
              <div className="pb-3 border-b border-vault-700 mb-3">
                <Typography variant="h6" gutterBottom>
                  File editing:
                </Typography>

                <Typography variant="body1">Source File:</Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                  gutterBottom
                >
                  {model.id}.{model.name.split(".").pop()}
                </Typography>
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    fullWidth
                    disabled={isReplacing}
                    component="label"
                    variant="contained"
                    startIcon={!isReplacing ? <FileUp /> : <RefreshCw />}
                  >
                    {isReplacing ? "Uploading..." : "Replace 3D Model File"}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".stl,.step,.stp,.3mf"
                      onChange={handleReplaceFile}
                    />
                  </Button>
                </div>

                <Typography variant="body1" gutterBottom>
                  Thumbnail:
                </Typography>
                <Stack direction="column" spacing={1}>
                  <div className="w-full object-cover mb-4 ">
                    <img
                      className="h-60 w-60 mx-auto rounded-md"
                      src={tempThumb != "" ? tempThumb : model.thumbnail}
                      alt="thumbnail"
                    />
                  </div>
                  <Button
                    disabled={isReplacing}
                    component="label"
                    variant="contained"
                    startIcon={!isReplacing ? <FileUp /> : <RefreshCw />}
                  >
                    {isReplacing ? "Uploading..." : "Replace Thumbnail"}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".jpeg,.png,.jpg"
                      onChange={handleReplaceThumbnail}
                    />
                  </Button>
                  <Button
                    disabled={isReplacing}
                    onClick={() => {
                      setTempThumb("");
                    }}
                    component="label"
                    variant="contained"
                    color="warning"
                    startIcon={<X />}
                  >
                    Clear Generated Thumbnail
                  </Button>
                </Stack>
              </div>
            )}

            {isEditing && (
              <div className="flex gap-2 pt-2">
                <Button
                  fullWidth
                  onClick={handleSave}
                  startIcon={<Save />}
                  variant="contained"
                  color="success"
                >
                  Save Changes
                </Button>
                <Button
                  fullWidth
                  onClick={() => setIsEditing(false)}
                  variant="contained"
                  color="secondary"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        <Stack
          direction="column"
          spacing={1}
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {!isEditing && (
            <Button
              fullWidth
              onClick={() => setIsEditing(true)}
              variant="outlined"
              endIcon={<Edit />}
            >
              Edit
            </Button>
          )}
          <Divider />
          <Typography variant="h6" color="error" gutterBottom>
            Warning Zone
          </Typography>

          <Button
            fullWidth
            onClick={() => onDelete(model.id)}
            endIcon={<Trash2 />}
            color="error"
            variant="contained"
          >
            Delete Model
          </Button>
        </Stack>

        {/* Error Modal Overlay */}
        {errorState.show && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-6 animate-in fade-in duration-200">
            <div className="bg-vault-800 border border-red-500/50 rounded-xl shadow-2xl w-full animate-in zoom-in-95 duration-200 p-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white">File Mismatch</h3>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    {errorState.message}
                  </p>
                </div>
                <button
                  onClick={() => setErrorState({ show: false, message: "" })}
                  className="w-full mt-2 py-2 bg-vault-700 hover:bg-vault-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Okay, got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailPanel;
