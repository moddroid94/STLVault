import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  CloudUpload,
  FileBox,
  Search,
  ArrowUpDown,
  CheckSquare,
  Square,
  MoreVertical,
  Trash2,
  ExternalLink,
  Download,
  Globe,
  Folder as FolderIcon,
  DownloadIcon,
  ScreenShareIcon,
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
import { IconButton } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";

interface ModelListProps {
  models: STLModel[];
  folders: Folder[];
  onUpload: (files: FileList) => void;
  onImport: () => void;
  onSelectModel: (model: STLModel) => void;
  onDelete: (id: string) => void;
  selectedModelId: string | null;

  // Selection Props
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
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
    null
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // Close menu when clicking outside

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
          m.tags.some((t) => t.toLowerCase().includes(query))
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
      JSON.stringify({ modelIds: idsToMove })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const selectionMode = selectedIds.size > 0;

  return (
    <div
      className="flex-1 p-2 sm:p-4 h-full overflow-y-auto bg-vault-800 relative flex flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-600/20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center backdrop-blur-sm m-4 rounded-xl pointer-events-none">
          <div className="text-center">
            <CloudUpload className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white">
              Drop 3D files here
            </h2>
            <p className="text-blue-200 mt-2">Supported: STL, STEP, 3MF</p>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Model Library
            </h2>
            <p className="text-slate-400 text-sm">
              {processedFolders.length}{" "}
              {processedFolders.length === 1 ? "folder - " : "folders - "}
              {processedModels.length}{" "}
              {processedModels.length === 1 ? "model" : "models"}
              {models.length !== processedModels.length &&
                ` (filtered from ${models.length})`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onSelectAll}
              className="bg-vault-700 hover:bg-vault-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              Select All
            </button>
            <button
              onClick={onImport}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Import URL
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <CloudUpload className="w-4 h-4" />
              Upload Model
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".stl,.step,.stp,.3mf"
              multiple
            />
          </div>
        </div>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or tags..."
              className="w-full bg-vault-900 border border-vault-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors placeholder:text-slate-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative min-w-[200px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full appearance-none bg-vault-900 border border-vault-700 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer transition-colors"
            >
              <option value="date-desc">Date Added (Newest)</option>
              <option value="date-asc">Date Added (Oldest)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="size-desc">Size (Largest)</option>
              <option value="size-asc">Size (Smallest)</option>
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Grid */}
      {processedModels.length === 0 && processedFolders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 border-2 border-dashed border-vault-700 rounded-xl bg-vault-900/30">
          {searchQuery ? (
            <>
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg">No matches found</p>
              <p className="text-sm">Try adjusting your search query</p>
            </>
          ) : (
            <>
              <FileBox className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">This folder is empty</p>
              <p className="text-sm">
                Drag and drop STL or STEP files to upload
              </p>
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
      ) : (
        <div>
          {/* Folders */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pb-5">
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
                className={`group bg-vault-900 border rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4 relative overflow-hidden
                    ${
                      dragOverFolderId === folder.id
                        ? "border-blue-400 bg-blue-900/10 ring-1 ring-blue-400"
                        : "border-vault-700 hover:border-vault-600 hover:bg-vault-800/50"
                    }
                  `}
              >
                <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-500 group-hover:text-blue-400 group-hover:scale-110 transition-all shrink-0">
                  <FolderIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-200 truncate group-hover:text-white">
                    {folder.name}
                  </h3>
                  <p className="text-xs text-slate-500">Folder</p>
                </div>
                {dragOverFolderId === folder.id && (
                  <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />
                )}
              </div>
            ))}
          </div>
          {/* Files */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-24">
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
                  className={`group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 relative active:cursor-grabbing ${
                    isSelected || selectedModelId === model.id
                      ? "border-blue-500 ring-1 ring-blue-500/50"
                      : "border-vault-700 hover:border-vault-600"
                  }`}
                >
                  <Card>
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
                      <div className="absolute bottom-[5.2rem] left-2 flex flex-wrap gap-1 justify-end max-w-[80%]">
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
                          href={api.getDownloadUrl(model)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Open in Slicer">
                        <IconButton
                          aria-label="open in slicer"
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
