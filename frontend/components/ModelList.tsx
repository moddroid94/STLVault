import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  CloudUpload,
  FileBox,
  Search,
  CheckSquare,
  MoreVertical,
  ExternalLink,
  Download,
  Globe,
  Folder as FolderIcon,
  DownloadIcon,
  ScreenShareIcon,
  XCircle,
  ChevronLeft,
} from "lucide-react";
import { STLModel, Folder } from "../types";
import { api } from "../services/api";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CardActionArea from "@mui/material/CardActionArea";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import { String } from "three/examples/jsm/transpiler/AST.js";
import { styled } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";

interface ModelListProps {
  models: STLModel[];
  folders: Folder[];
  currentFolderName: string;
  onBackNavigation: () => void;
  onUpload: (files: FileList) => void;
  onImport: () => void;
  onSelectModel: (model: STLModel) => void;
  onDelete: (id: string) => void;
  selectedModelId: string | null;

  // Selection Props
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (filtered) => void;
  onClearSelection: () => void;

  // Folder Interaction Props
  onNavigateFolder: (id: string) => void;
  onMoveToFolder: (folderId: string, modelIds: string[]) => void;
  onUploadToFolder: (folderId: string, files: FileList) => void;
}

type SortOption =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc";

const ModelList: React.FC<ModelListProps> = ({
  models,
  folders,
  currentFolderName,
  onBackNavigation,
  onUpload,
  onImport,
  onSelectModel,
  onDelete,
  selectedModelId,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onNavigateFolder,
  onMoveToFolder,
  onUploadToFolder,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [activeMenuModelId, setActiveMenuModelId] = useState<string | null>(
    null,
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const VisuallyHiddenInput = styled("input")({
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    bottom: 0,
    left: 0,
    whiteSpace: "nowrap",
    width: 1,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch =
      "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    setIsTouchDevice(Boolean(isTouch));
  }, []);

  const processedModels = useMemo(() => {
    let result = [...models];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return b.dateAdded - a.dateAdded;
        case "date-asc":
          return a.dateAdded - b.dateAdded;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "size-desc":
          return b.size - a.size;
        case "size-asc":
          return a.size - b.size;
        default:
          return 0;
      }
    });

    return result;
  }, [models, searchQuery, sortBy]);

  const processedFolders = useMemo(() => {
    let result = [...folders];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }
    // Always sort folders by name
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [folders, searchQuery]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drag overlay if dragging files, not elements
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Necessary to prevent default to allow drop
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if we are just moving to a child element within the drop zone
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    // 1. Files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadToFolder(folderId, e.dataTransfer.files);
      return;
    }

    // 2. Move Models
    try {
      const data = e.dataTransfer.getData("application/json");
      if (data) {
        const { modelIds } = JSON.parse(data);
        if (Array.isArray(modelIds) && modelIds.length > 0) {
          onMoveToFolder(folderId, modelIds);
        }
      }
    } catch (err) {
      console.error("Failed to process drop on folder", err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  const handleCardDragStart = (e: React.DragEvent, modelId: string) => {
    // If the user drags a card, we initiate a move operation
    const idsToMove = selectedIds.has(modelId)
      ? Array.from(selectedIds)
      : [modelId];

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ modelIds: idsToMove }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const selectionMode = selectedIds.size > 0;

  return (
    <div className="flex-1 p-2 sm:p-4 h-full overflow-y-auto relative flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col gap-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: "baseline",
              }}
            >
              <Typography variant="h4">{currentFolderName}</Typography>
              <Typography variant="body1" sx={{ color: "text.secondary" }}>
                {processedFolders.length}{" "}
                {processedFolders.length === 1 ? "folder • " : "folders • "}
                {processedModels.length}{" "}
                {processedModels.length === 1 ? "model" : "models"}
                {models.length !== processedModels.length &&
                  ` ( filtered from: ${models.length} )`}
              </Typography>
            </Stack>
          </div>

          <div className="flex flex-wrap gap-3">
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<CheckSquare />}
                onClick={() => onSelectAll(processedModels)}
              >
                {`${
                  models.length === selectedIds.size
                    ? "Unselect All"
                    : "Select All"
                } `}
              </Button>
              <Button
                variant="contained"
                startIcon={<Globe />}
                onClick={onImport}
              >
                Import URL
              </Button>
              <Button
                component="label"
                role={undefined}
                variant="contained"
                tabIndex={-1}
                startIcon={<CloudUpload />}
              >
                Upload models
                <VisuallyHiddenInput
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".stl,.step,.stp,.3mf"
                  multiple
                />
              </Button>
            </Stack>
          </div>
        </div>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-4 ">
          <div className="relative flex-1">
            <TextField
              fullWidth
              id="search-input"
              label="Search"
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        className={
                          searchQuery != ""
                            ? "transition-all opacity-100"
                            : "transition-all opacity-0"
                        }
                        onClick={() => {
                          setSearchQuery("");
                          document.getElementById("search-input").value = "";
                        }}
                      >
                        <XCircle />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              variant="outlined"
            />
          </div>

          <div className="relative min-w-[200px]">
            <FormControl fullWidth>
              <InputLabel id="demo-simple-select-label">Sort</InputLabel>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={sortBy}
                label="Sort"
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <MenuItem value="date-desc">Date Added (Newest)</MenuItem>
                <MenuItem value="date-asc">Date Added (Oldest)</MenuItem>
                <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                <MenuItem value="size-desc">Size (Largest)</MenuItem>
                <MenuItem value="size-asc">Size (Smallest)</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>
      </div>

      {/* Grid */}
      {processedModels.length === 0 && processedFolders.length === 0 ? (
        <div>
          <Button
            disabled={currentFolderName === "All Models"}
            aria-label="navigate back"
            startIcon={<ChevronLeft />}
            onClick={() => {
              onBackNavigation();
            }}
          >
            Back
          </Button>
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center flex-1 mt-2 text-slate-500 border-2 border-dashed border-vault-700 rounded-xl bg-vault-900/30"
          >
            {searchQuery ? (
              <>
                <Search className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg">No matches found</p>
                <p className="text-sm">Try adjusting your search query</p>
              </>
            ) : (
              <>
                {isDragging && (
                  <div className="relative bg-white/20 border-4 border-dashed border-white-500 m-2 z-50 flex items-center justify-center backdrop-blur-sm m-4 rounded-md pointer-events-none">
                    <div className="text-center p-4">
                      <CloudUpload className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-bounce" />
                      <h2 className="text-2xl font-bold text-white">
                        Drop 3D files
                      </h2>
                      <p className="text-blue-200 mt-2">
                        Supported: STL, STEP, 3MF
                      </p>
                    </div>
                  </div>
                )}
                {!isDragging && (
                  <div className="flex-col text-center py-4">
                    <FileBox className="w-16 h-16 mb-4 mx-auto opacity-50" />
                    <p className="text-lg">This folder is empty</p>
                    <p className="text-sm">
                      Drag and drop STL or STEP files to upload
                    </p>
                  </div>
                )}
                {isTouchDevice && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Tap to choose files
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <Button
            disabled={currentFolderName === "All Models"}
            aria-label="navigate back"
            startIcon={<ChevronLeft />}
            onClick={() => {
              onBackNavigation();
            }}
          >
            Back
          </Button>
          {/* Folders */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pb-5 pt-2">
            {/* Render Folders First */}
            {processedFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => onNavigateFolder(folder.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverFolderId(folder.id);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverFolderId(null);
                }}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                className={`cursor-pointer transition-all flex items-center relative overflow-hidden hover:-translate-y-1 ${
                  dragOverFolderId === folder.id
                    ? " -translate-y-1 brightness-150 ring-2 ring-white rounded-md"
                    : " "
                }`}
              >
                <Card className="w-full">
                  <CardActionArea>
                    <CardContent>
                      <Stack
                        sx={{
                          justifyContent: "start",
                          alignItems: "center",
                        }}
                        direction="row"
                        spacing={2}
                      >
                        <Avatar sx={{}}>
                          <FolderIcon />
                        </Avatar>
                        <Stack>
                          <Typography variant="body1" component="div">
                            {folder.name}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            Folder
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </div>
            ))}
          </div>

          {/* Files */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-24"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag Overlay */}
            {isDragging && (
              <div className="relative bg-white/20 border-4 border-dashed border-white-500 z-50 flex items-center justify-center backdrop-blur-sm m-4 rounded-md pointer-events-none">
                <div className="text-center ">
                  <CloudUpload className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-bounce" />
                  <h2 className="text-2xl font-bold text-white">
                    Drop 3D files
                  </h2>
                  <p className="text-blue-200 mt-2">
                    Supported: STL, STEP, 3MF
                  </p>
                </div>
              </div>
            )}

            {/* Render Models */}
            {processedModels.map((model) => {
              const isSelected = selectedIds.has(model.id);
              const isMenuOpen = activeMenuModelId === model.id;

              return (
                <div
                  key={model.id}
                  draggable={true}
                  onDragStart={(e) => handleCardDragStart(e, model.id)}
                  onClick={() => {
                    if (selectionMode) {
                      onToggleSelection(model.id);
                    } else {
                      onSelectModel(model);
                    }
                  }}
                  className={`group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 relative active:cursor-grabbing`}
                >
                  <Card raised={isSelected}>
                    <CardActionArea>
                      {model.thumbnail ? (
                        <CardMedia
                          component="div"
                          className="h-60 object-cover"
                          image={model.thumbnail}
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-gradient-to-tr from-blue-900/40 to-transparent" />
                          <FileBox className="w-12 h-12 text-slate-600 group-hover:text-blue-400 transition-colors" />
                        </>
                      )}
                      <div className="absolute bottom-[5.2rem] left-2 flex gap-1 max-w-[80%]">
                        {model.tags.slice(0, 2).map((tag) => (
                          <Chip
                            sx={{
                              borderRadius: 1,
                            }}
                            label={tag}
                            key={tag}
                            color="primary"
                            size="small"
                          />
                        ))}
                        {model.tags.length > 2 && (
                          <Chip
                            sx={{
                              borderRadius: 1,
                            }}
                            label={`+${model.tags.length - 2}`}
                            color="secondary"
                            size="small"
                          />
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <Chip
                          sx={{
                            borderRadius: 1,
                            fontWeight: "medium",
                          }}
                          label={model.name.split(".").pop().toUpperCase()}
                          color="info"
                          size="small"
                        />
                      </div>
                      <CardContent>
                        <Typography gutterBottom variant="body1" noWrap={true}>
                          {model.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {(model.size / (1024 * 1024)).toFixed(2)}
                          {" MB  • "}
                          {new Date(model.dateAdded).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                    <CardActions>
                      <Tooltip title="Download">
                        <IconButton
                          aria-label="download"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          href={api.getDownloadUrl(model)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Open in Slicer">
                        <IconButton
                          aria-label="open in slicer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          href={api.getSlicerUrl(model)}
                        >
                          <ScreenShareIcon />
                        </IconButton>
                      </Tooltip>
                      <div className="absolute right-2">
                        <IconButton
                          id={`fade-button-${model.id}`}
                          aria-controls={
                            isMenuOpen ? `fade-menu-${model.id}` : undefined
                          }
                          aria-haspopup="true"
                          aria-expanded={isMenuOpen ? "true" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnchorEl(e.currentTarget);
                            setActiveMenuModelId(isMenuOpen ? null : model.id);
                          }}
                        >
                          <MoreVertical />
                        </IconButton>
                        <Menu
                          id={`fade-menu-${model.id}`}
                          anchorEl={anchorEl}
                          open={isMenuOpen}
                          onClose={(e) => {
                            e.stopPropagation();
                            setActiveMenuModelId(null);
                          }}
                          anchorOrigin={{
                            vertical: "top",
                            horizontal: "right",
                          }}
                          transformOrigin={{
                            vertical: "top",
                            horizontal: "right",
                          }}
                        >
                          <MenuItem
                            onClick={(e) => {
                              onSelectModel(model);
                              setActiveMenuModelId(null);
                            }}
                          >
                            Open
                          </MenuItem>
                          <Divider />
                          <MenuItem
                            sx={{ color: "#dd3434ff" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Call delete FIRST to ensure propagation isn't cut off by component unmounting if list updates
                              onDelete(model.id);
                              setActiveMenuModelId(null);
                            }}
                          >
                            Delete
                          </MenuItem>
                        </Menu>
                      </div>
                    </CardActions>
                  </Card>
                  {/* Selection Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelection(model.id);
                    }}
                    className={`absolute top-2 left-2 z-10 rounded backdrop-blur-sm transition-opacity duration-200
                    ${
                      isSelected || selectionMode
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={null}
                      slotProps={{
                        input: { "aria-label": "controlled" },
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelList;
