import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CssBaseline from "@mui/material/CssBaseline";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import JSZip from "jszip";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  Download,
  FileUp,
  FolderInput,
  Globe,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import DetailPanel from "./components/DetailPanel";
import ManualModal from "./components/ManualModal";
import ModelList from "./components/ModelList";
import Navbar from "./components/Navbar";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useVisualViewport } from "./hooks/useVisualViewport";
import { api } from "./services/api";
import { generateThumbnail } from "./services/thumbnailGenerator";
import {
  Folder,
  ModelGroup,
  STLModel,
  STLModelCollection,
  StorageStats,
} from "./types";

const App = () => {
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const isMobile = !isDesktop;
  const visualViewport = useVisualViewport();
  const darkTheme = createTheme({
    palette: {
      mode: "dark",
    },
  });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [models, setModels] = useState<STLModel[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    used: 0,
    total: 0,
  });

  const [currentFolderId, setCurrentFolderId] = useState<string>("all");
  const [currentFolderParentId, setCurrentFolderParentId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileSidebarMounted, setIsMobileSidebarMounted] = useState(false);
  const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(false);

  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [bulkTags, setBulkTags] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupMode, setGroupMode] = useState<"new" | "existing">("new");
  const [groupName, setGroupName] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [uploadTags, setUploadTags] = useState("");

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportOptionsModal, setShowImportOptionsModal] = useState(false);
  const [modelsOptions, setModelsOptions] = useState<STLModelCollection[]>([]);
  const [folderOptions, setFolderOptions] = useState<Set<string>>(new Set());
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set(),
  );
  const [importUrl, setImportUrl] = useState("");
  const [importFolderId, setImportFolderId] = useState("");
  const port = import.meta.env.VITE_API_URL;
  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: "single" | "bulk" | "folder";
    id?: string;
  }>({ isOpen: false, type: "single" });

  const [manualState, setManualState] = useState<{
    id: string | null;
    mode: "view" | "edit";
  }>({ id: null, mode: "view" });

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedFolders, fetchedModels, fetchedGroups, fetchedStats] =
          await Promise.all([
            api.getFolders(),
            api.getModels("all"),
            api.getModelGroups(),
            api.getStorageStats(),
          ]);
        setFolders(fetchedFolders);
        setModels(fetchedModels);
        setModelGroups(fetchedGroups);
        setStorageStats(fetchedStats);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Refresh storage stats when models change (upload, delete, replace)
  useEffect(() => {
    api
      .getStorageStats()
      .then(setStorageStats)
      .catch((e) => console.error("Failed to refresh storage stats", e));
  }, [models]);

  // Filter models based on selection
  const filteredModels =
    currentFolderId === "all"
      ? models
      : models.filter((m) => m.folderId === currentFolderId);

  // Filter subfolders based on selection
  const filteredFolders =
    currentFolderId === "all"
      ? folders.filter((f) => f.parentId == null)
      : folders.filter((f) => f.parentId === currentFolderId);

  // Clear selection when changing folders to avoid confusion
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentFolderParentId(
      currentFolderId === "all"
        ? "all"
        : folders.find((f) => f.id === currentFolderId)?.parentId || "all",
    );
  }, [currentFolderId]);

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) setIsMobileSidebarOpen(false);
  }, [isDesktop]);

  // Mobile sidebar animation: keep mounted during close transition
  useEffect(() => {
    const transitionMs = 220;
    let timeoutId: number | undefined;

    if (isMobileSidebarOpen) {
      setIsMobileSidebarMounted(true);
      // Delay visibility to allow initial off-screen position to render before sliding in
      timeoutId = window.setTimeout(() => setIsMobileSidebarVisible(true), 10);
    } else {
      setIsMobileSidebarVisible(false);
      timeoutId = window.setTimeout(
        () => setIsMobileSidebarMounted(false),
        transitionMs,
      );
    }

    return () => {
      if (typeof timeoutId === "number") window.clearTimeout(timeoutId);
    };
  }, [isMobileSidebarOpen]);

  // Mobile sidebar UX: ESC to close + prevent body scroll
  useEffect(() => {
    if (!isMobileSidebarMounted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileSidebarOpen(false);
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileSidebarMounted]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;
  const manualModel = models.find((m) => m.id === manualState.id) || null;

  const currentFolderName =
    currentFolderId === "all"
      ? "All Models"
      : folders.find((f) => f.id === currentFolderId)?.name || "Folder";

  const handleCreateFolder = async (
    name: string,
    parentId: string | null = null,
  ) => {
    try {
      const newFolder = await api.createFolder(name, parentId);
      setFolders((prev) => [...prev, newFolder]);
      // If created under a parent, ensure parent is expanded in Sidebar (Sidebar handles its own expansion state, but good to know)
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    try {
      await api.updateFolder(id, newName);
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name: newName } : f)),
      );
    } catch (error) {
      console.error("Failed to rename folder", error);
    }
  };

  const handleDeleteFolder = (id: string) => {
    const hasModels = models.some((m) => m.folderId === id);
    const hasSubfolders = folders.some((f) => f.parentId === id);

    if (hasModels || hasSubfolders) {
      alert(
        "Folder must be empty to delete. Please delete or move all models and subfolders first.",
      );
      return;
    }
    setDeleteConfirmState({ isOpen: true, type: "folder", id });
  };

  // Core upload logic
  const executeUpload = async (
    files: File[],
    targetFolderId: string,
    tags: string[],
  ) => {
    setUploadQueue((prev) => prev + files.length);

    for (const file of files) {
      try {
        let thumbnail: string | undefined = undefined;
        try {
          thumbnail = await generateThumbnail(file);
        } catch (e) {
          console.warn(
            "Thumbnail generation failed, uploading without thumbnail",
          );
        }

        const newModel = await api.uploadModel(
          file,
          targetFolderId,
          thumbnail,
          tags,
        );
        setModels((prev) => [newModel, ...prev]);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      } finally {
        setUploadQueue((prev) => prev - 1);
      }
    }
  };

  const handleUpload = async (
    fileList: FileList,
    specificFolderId?: string,
  ) => {
    const files = Array.from(fileList);

    // If dropping into the general area ("all") and not a specific folder drop
    // We want to show the modal to let user pick a folder and add tags
    if (!specificFolderId && currentFolderId === "all") {
      setPendingFiles(files);
      // Default to first folder if available
      setUploadFolderId(folders.length > 0 ? folders[0].id : "");
      setUploadTags("");
      setShowUploadModal(true);
      return;
    }

    // Normal flow (specific folder target or current view is a folder)
    const targetFolderId = specificFolderId || currentFolderId;

    // Fallback if for some reason 'all' is passed without modal (shouldn't happen with above check)
    const finalFolderId =
      targetFolderId === "all" && folders.length > 0
        ? folders[0].id
        : targetFolderId;

    await executeUpload(files, finalFolderId, []);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFolderId) return;

    const tags = uploadTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setShowUploadModal(false);
    await executeUpload(pendingFiles, uploadFolderId, tags);
    setPendingFiles([]);
  };

  const handleOpenImport = () => {
    setImportUrl("");
    setSelectedOptions(new Set());
    setModelsOptions([]);
    // Pre-select current folder if specific, otherwise first available
    setImportFolderId(
      currentFolderId !== "all" ? currentFolderId : folders[0]?.id || "",
    );
    setShowImportModal(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl || !importFolderId) return;

    try {
      const ModelOptions = await api.retrieveModelOptions(importUrl);
      const NewSet = new Set("");
      ModelOptions.forEach((m) => {
        if (!NewSet.has(m.folder)) {
          NewSet.add(m.folder);
        }
      });
      setFolderOptions(NewSet);
      setModelsOptions(ModelOptions);
      setShowImportModal(false);
      setShowImportOptionsModal(true);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import from URL");
    }
  };

  const handleOptionsToggleSelection = (id: string) => {
    const newSet = new Set(selectedOptions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOptions(newSet);
  };

  const handleUpdateSTEPThumbnail = async (newModel: STLModel) => {
    const base = localStorage.getItem("api-port-override") || import.meta.env.VITE_API_URL || "";
    const fileUrl = newModel.url?.startsWith("http")
      ? newModel.url
      : `${base.replace(/\/+$/, "")}${newModel.url?.startsWith("/") ? "" : "/"}${newModel.url || ""}`;
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) return;
      const thumbnailBuffer = await response.arrayBuffer();
      const thumbnail = await generateThumbnail(
        new File([thumbnailBuffer], newModel.name),
      );
      const newerModel = await api.updateModel(newModel.id, {
        thumbnail: thumbnail,
      });
      setModels((prev) => [newerModel, ...prev]);
    } catch (e) {
      console.warn("Thumbnail generation failed, uploading without thumbnail", e);
    }
  };

  const handleImportChoice = async () => {
    if (!importUrl || !importFolderId) return;

    setIsLoading(true);
    setShowImportOptionsModal(false);
    setUploadQueue((prev) => prev + selectedOptions.size);
    try {
      for (const model of modelsOptions) {
        if (selectedOptions.has(model.id)) {
          let newModel = await api.importModelFromId(
            model.id,
            model.name,
            model.parentId,
            model.previewPath,
            importFolderId,
            model.typeName,
            model.source || "printables",
          );
          await handleUpdateSTEPThumbnail(newModel);
          setUploadQueue((prev) => prev - 1);
        }
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import from URL");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateModel = async (id: string, updates: Partial<STLModel>) => {
    try {
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      );
      await api.updateModel(id, updates);
    } catch (error) {
      console.error("Failed to update model:", error);
    }
  };

  const handleUploadManual = async (id: string, file: File) => {
    try {
      const updated = await api.uploadManual(id, file);
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, manual: updated.manual } : m)),
      );
      return updated;
    } catch (error) {
      console.error("Failed to upload manual:", error);
      alert("Failed to upload manual");
      throw error;
    }
  };

  const handleDeleteManual = async (id: string) => {
    try {
      const updated = await api.deleteManual(id);
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, manual: updated.manual } : m)),
      );
    } catch (error) {
      console.error("Failed to delete manual:", error);
      alert("Failed to delete manual");
    }
  };

  const handleDeleteModel = (id: string) => {
    console.log("Opening delete confirmation for model:", id);
    setDeleteConfirmState({ isOpen: true, type: "single", id });
  };

  const handleBulkDelete = () => {
    console.log("Opening bulk delete confirmation for:", selectedIds);
    setDeleteConfirmState({ isOpen: true, type: "bulk" });
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmState;
    console.log(`Executing delete type: ${type}, id: ${id}`);

    try {
      if (type === "single" && id) {
        await api.deleteModel(id);
        setModels((prev) => prev.filter((m) => m.id !== id));
        if (selectedModelId === id) setSelectedModelId(null);
      } else if (type === "bulk") {
        const ids = Array.from(selectedIds) as string[];
        await api.bulkDeleteModels(ids);
        setModels((prev) => prev.filter((m) => !ids.includes(m.id)));
        setSelectedIds(new Set());
        if (selectedModelId && ids.includes(selectedModelId))
          setSelectedModelId(null);
      } else if (type === "folder" && id) {
        await api.deleteFolder(id);
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (currentFolderId === id) setCurrentFolderId("all");
      }
    } catch (error) {
      console.error("Delete operation failed:", error);
      alert("Failed to delete. Please check console.");
    } finally {
      setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // --- Bulk Actions Logic ---

  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleGroupSelection = (ids: string[], selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const handleSelectAll = (filtered: STLModel[]) => {
    const filteredIds = filtered.map((model) => model.id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));

    setSelectedIds((current) => {
      const next = new Set(current);
      filteredIds.forEach((id) =>
        allSelected ? next.delete(id) : next.add(id),
      );
      return next;
    });
  };

  const handleBulkMoveSubmit = async (targetFolderId: string) => {
    try {
      const ids = Array.from(selectedIds) as string[];
      await api.bulkMoveModels(ids, targetFolderId);
      setModels((prev) =>
        prev.map((m) =>
          selectedIds.has(m.id) ? { ...m, folderId: targetFolderId } : m,
        ),
      );
      setShowMoveModal(false);
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Bulk move failed", e);
    }
  };

  const handleDropMove = async (targetFolderId: string, modelIds: string[]) => {
    try {
      await api.bulkMoveModels(modelIds, targetFolderId);
      setModels((prev) =>
        prev.map((m) =>
          modelIds.includes(m.id) ? { ...m, folderId: targetFolderId } : m,
        ),
      );
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Drop move failed", e);
    }
  };

  const handleBulkTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ids = Array.from(selectedIds) as string[];
      const tags = bulkTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api.bulkAddTags(ids, tags);
      setModels((prev) =>
        prev.map((m) => {
          if (selectedIds.has(m.id)) {
            return { ...m, tags: [...new Set([...m.tags, ...tags])] };
          }
          return m;
        }),
      );
      setShowTagModal(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk tag failed", err);
    }
  };

  const refreshModelsAndGroups = async () => {
    const [fetchedModels, fetchedGroups] = await Promise.all([
      api.getModels("all"),
      api.getModelGroups(),
    ]);
    setModels(fetchedModels);
    setModelGroups(fetchedGroups);
  };

  const handleModelsChanged = async () => {
    setModels(await api.getModels("all"));
  };

  const handleOpenGroupModal = () => {
    setGroupMode("new");
    setGroupName("");
    setTargetGroupId(modelGroups[0]?.id || "");
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const modelIds = Array.from(selectedIds);
    if (modelIds.length === 0) return;

    try {
      if (groupMode === "new") {
        await api.createModelGroup(groupName, modelIds);
      } else {
        await api.addModelsToGroup(targetGroupId, modelIds);
      }
      await refreshModelsAndGroups();
      setSelectedIds(new Set());
      setShowGroupModal(false);
    } catch (error) {
      console.error("Failed to group models", error);
      alert(
        "Grouping failed. A model can only belong to one print group at a time.",
      );
    }
  };

  const handleDeleteModelGroup = async (groupId: string) => {
    try {
      await api.deleteModelGroup(groupId);
      await refreshModelsAndGroups();
    } catch (error) {
      console.error("Failed to dissolve model group", error);
      alert("Failed to dissolve print group");
    }
  };

  const handleRemoveModelFromGroup = async (
    groupId: string,
    modelId: string,
  ) => {
    try {
      await api.removeModelFromGroup(groupId, modelId);
      await refreshModelsAndGroups();
    } catch (error) {
      console.error("Failed to remove model from group", error);
      alert("Failed to remove model from print group");
    }
  };

  const handleBulkDownload = async () => {
    setIsLoading(true);
    try {
      const zip = new JSZip();
      const selectedModels = models.filter((m) => selectedIds.has(m.id));

      // Add files to zip
      const filePromises = selectedModels.map(async (model) => {
        try {
          const url = api.getDownloadUrl(model);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${model.name}`);
          const blob = await response.blob();
          zip.file(model.name, blob);
        } catch (err) {
          console.error(`Error downloading ${model.name} for zip:`, err);
        }
      });

      await Promise.all(filePromises);

      // Generate zip
      const content = await zip.generateAsync({ type: "blob" });
      const saveUrl = URL.createObjectURL(content);

      // Trigger download
      const link = document.createElement("a");
      link.href = saveUrl;
      link.download = `stlvault-batch-${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(saveUrl);

      // Clear selection
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Bulk download failed:", error);
      alert("Failed to generate zip file.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div
        className={`${
          isDesktop ? "flex" : "flex flex-col"
        } h-dvh text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden`}
      >
        {isDesktop ? (
          <Sidebar
            folders={folders}
            models={models}
            currentFolderId={currentFolderId}
            storageStats={storageStats}
            onSelectFolder={(id) => {
              setCurrentFolderId(id);
              setSelectedModelId(null);
              setShowSettings(false);
            }}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveToFolder={handleDropMove}
            onUploadToFolder={(folderId, files) =>
              handleUpload(files, folderId)
            }
            onOpenSettings={() => setShowSettings(true)}
            variant="desktop"
          />
        ) : (
          <>
            <Navbar
              title="STL Vault"
              subtitle={showSettings ? "Settings" : currentFolderName}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenSettings={() => setShowSettings(true)}
              showMenuButton={!showSettings}
            />

            {isMobileSidebarMounted && (
              <div className="fixed inset-0 z-[70]">
                <div
                  className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
                    isMobileSidebarVisible ? "opacity-100" : "opacity-0"
                  }`}
                  onClick={() => setIsMobileSidebarOpen(false)}
                />
                <div
                  className={`absolute inset-y-0 left-0 w-[85vw] max-w-[360px] transform transition-transform duration-200 ease-out ${
                    isMobileSidebarVisible
                      ? "translate-x-0"
                      : "-translate-x-full"
                  }`}
                >
                  <Sidebar
                    folders={folders}
                    models={models}
                    currentFolderId={currentFolderId}
                    storageStats={storageStats}
                    onSelectFolder={(id) => {
                      setCurrentFolderId(id);
                      setSelectedModelId(null);
                      setShowSettings(false);
                      setIsMobileSidebarOpen(false);
                    }}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onMoveToFolder={handleDropMove}
                    onUploadToFolder={(folderId, files) =>
                      handleUpload(files, folderId)
                    }
                    onOpenSettings={() => {
                      setShowSettings(true);
                      setIsMobileSidebarOpen(false);
                    }}
                    variant="mobile"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Settings View */}
        {showSettings ? (
          <Settings onBack={() => setShowSettings(false)} />
        ) : (
          <>
            <main className="flex-1 flex overflow-hidden relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-vault-900 z-50">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="text-slate-400 animate-pulse">
                      Processing...
                    </p>
                  </div>
                </div>
              ) : (
                <ModelList
                  models={filteredModels}
                  allModels={models}
                  modelGroups={modelGroups}
                  folders={filteredFolders}
                  currentFolderName={currentFolderName}
                  onBackNavigation={() => {
                    setCurrentFolderId(currentFolderParentId);
                  }}
                  onUpload={(files) => handleUpload(files)}
                  onImport={handleOpenImport}
                  onSelectModel={(m) => setSelectedModelId(m.id)}
                  onDelete={handleDeleteModel}
                  onOpenManual={(m) =>
                    setManualState({ id: m.id, mode: "view" })
                  }
                  selectedModelId={selectedModelId}
                  // Selection Props
                  selectedIds={selectedIds}
                  onToggleSelection={handleToggleSelection}
                  onToggleGroupSelection={handleGroupSelection}
                  onSelectAll={(filtered) => handleSelectAll(filtered)}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onNavigateFolder={(id) => setCurrentFolderId(id)}
                  onMoveToFolder={handleDropMove}
                  onUploadToFolder={(folderId, files) =>
                    handleUpload(files, folderId)
                  }
                  onDeleteModelGroup={handleDeleteModelGroup}
                  onRemoveModelFromGroup={handleRemoveModelFromGroup}
                />
              )}

              {/* Upload Indicator */}
              {uploadQueue > 0 && (
                <div className="absolute bottom-6 left-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">
                    Uploading {uploadQueue} file(s)...
                  </span>
                </div>
              )}

              {/* Backdrop for closing sidebar */}
              <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] z-20 transition-opacity duration-300 ${
                  selectedModelId
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setSelectedModelId(null)}
              />

              {/* Slide-over panel */}
              <div
                className={`absolute top-0 right-0 h-full transition-transform duration-300 ease-in-out transform ${
                  selectedModelId ? "translate-x-0" : "translate-x-full"
                } z-30`}
              >
                <DetailPanel
                  model={selectedModel}
                  onClose={() => setSelectedModelId(null)}
                  onUpdate={handleUpdateModel}
                  onDelete={handleDeleteModel}
                  onOpenManual={(m) =>
                    setManualState({ id: m.id, mode: "view" })
                  }
                  onEditManual={(m) =>
                    setManualState({ id: m.id, mode: "edit" })
                  }
                  onUploadManual={handleUploadManual}
                  onDeleteManual={handleDeleteManual}
                  onModelsChanged={handleModelsChanged}
                />
              </div>

              {/* Floating Action Bar */}
              {selectedIds.size > 0 && (
                <Paper
                  elevation={8}
                  sx={{
                    position: "absolute",
                    bottom: 32,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 50,
                    px: 2,
                    py: 1,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                    justifyContent: "center",
                    maxWidth: "calc(100vw - 24px)",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ pr: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {selectedIds.size}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      selected
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Clear selection"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      <X className="w-4 h-4" />
                    </IconButton>
                  </Stack>
                  <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Button size="small" startIcon={<Boxes className="w-4 h-4" />} onClick={handleOpenGroupModal}>
                      Group
                    </Button>
                    <Button size="small" startIcon={<FolderInput className="w-4 h-4" />} onClick={() => setShowMoveModal(true)}>
                      Move
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Tags className="w-4 h-4" />}
                      onClick={() => {
                        setBulkTags("");
                        setShowTagModal(true);
                      }}
                    >
                      Tag
                    </Button>
                    <Button size="small" startIcon={<Download className="w-4 h-4" />} onClick={handleBulkDownload}>
                      Download
                    </Button>
                    <Button size="small" color="error" startIcon={<Trash2 className="w-4 h-4" />} onClick={handleBulkDelete}>
                      Delete
                    </Button>
                  </Stack>
                </Paper>
              )}

              {/* Modals Layer */}

              <ManualModal
                model={manualModel}
                initialMode={manualState.mode}
                onClose={() => setManualState({ id: null, mode: "view" })}
                onSave={handleUploadManual}
              />

              {/* Upload Modal */}
              <Dialog
                open={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                fullWidth
                maxWidth="xs"
              >
                <DialogTitle>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FileUp className="w-5 h-5 text-blue-500" />
                      <Typography variant="h6" component="span">Upload files</Typography>
                    </Stack>
                    <IconButton onClick={() => setShowUploadModal(false)} aria-label="Close upload dialog" size="small">
                      <X className="w-5 h-5" />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent>
                  <Stack spacing={2} sx={{ mt: 0.5 }}>
                    <Alert severity="info" variant="outlined">
                      {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} selected:{" "}
                      {pendingFiles.map((f) => f.name).join(", ")}
                    </Alert>
                    <Box component="form" id="upload-form" onSubmit={handleConfirmUpload}>
                      <Stack spacing={2}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          required
                          label="Destination folder"
                          value={uploadFolderId}
                          onChange={(e) => setUploadFolderId(e.target.value)}
                          SelectProps={{ native: true }}
                        >
                          <option value="" disabled>
                            Select a folder…
                          </option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </TextField>
                        <TextField
                          fullWidth
                          size="small"
                          label="Tags (optional)"
                          placeholder="scifi, armor, weapon..."
                          value={uploadTags}
                          onChange={(e) => setUploadTags(e.target.value)}
                          helperText="Separate tags with commas"
                        />
                      </Stack>
                    </Box>
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowUploadModal(false)}>Cancel</Button>
                  <Button type="submit" form="upload-form" variant="contained" disabled={!uploadFolderId}>
                    Upload
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Import URL Modal */}
              <Dialog
                open={showImportModal}
                onClose={() => setShowImportModal(false)}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Globe className="w-5 h-5 text-indigo-500" />
                      <Typography variant="h6" component="span">Import from URL</Typography>
                    </Stack>
                    <IconButton onClick={() => setShowImportModal(false)} aria-label="Close import dialog" size="small">
                      <X className="w-5 h-5" />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent>
                  <Box component="form" id="import-url-form" onSubmit={handleImportSubmit} sx={{ mt: 0.5 }}>
                    <Stack spacing={2}>
                      <TextField
                        autoFocus
                        required
                        fullWidth
                        size="small"
                        type="url"
                        label="Model URL"
                        placeholder="https://www.printables.com/model/... or https://makerworld.com/..."
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        helperText="Paste a link from Printables or MakerWorld"
                      />
                      <TextField
                        select
                        required
                        fullWidth
                        size="small"
                        label="Destination folder"
                        value={importFolderId}
                        onChange={(e) => setImportFolderId(e.target.value)}
                        SelectProps={{ native: true }}
                      >
                        <option value="" disabled>
                          Select a folder…
                        </option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </TextField>
                    </Stack>
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowImportModal(false)}>Cancel</Button>
                  <Button type="submit" form="import-url-form" variant="contained" disabled={!importUrl || !importFolderId}>
                    Import
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Import Options Modal */}
              <Dialog
                open={showImportOptionsModal}
                onClose={() => setShowImportOptionsModal(false)}
                fullWidth
                maxWidth="md"
              >
                <DialogTitle>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Globe className="w-5 h-5 text-indigo-500" />
                      <Typography variant="h6" component="span">
                        Select files to import
                      </Typography>
                    </Stack>
                    <IconButton
                      onClick={() => setShowImportOptionsModal(false)}
                      aria-label="Close import options dialog"
                      size="small"
                    >
                      <X className="w-5 h-5" />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={1}>
                    {Array.from(folderOptions)
                      .sort((a, b) => (a || "").localeCompare(b || ""))
                      .map((folderName) => {
                        const folderModels = modelsOptions.filter(
                          (m) => (m.folder ?? "") === (folderName ?? ""),
                        );
                        const allChecked =
                          folderModels.length > 0 &&
                          folderModels.every((m) => selectedOptions.has(m.id));
                        const someChecked =
                          folderModels.some((m) => selectedOptions.has(m.id)) &&
                          !allChecked;
                        return (
                          <Accordion key={folderName || "__root__"} defaultExpanded>
                            <AccordionSummary expandIcon={<ChevronDown className="w-5 h-5" />}>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ width: "100%", pr: 1 }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={allChecked}
                                  indeterminate={someChecked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const next = new Set(selectedOptions);
                                    if (allChecked) {
                                      folderModels.forEach((m) => next.delete(m.id));
                                    } else {
                                      folderModels.forEach((m) => next.add(m.id));
                                    }
                                    setSelectedOptions(next);
                                  }}
                                  inputProps={{ "aria-label": `Select all in ${folderName || "Root Folder"}` }}
                                />
                                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                                  {folderName || "Root Folder"}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={`${folderModels.filter((m) => selectedOptions.has(m.id)).length}/${folderModels.length}`}
                                />
                              </Stack>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Stack spacing={1}>
                                {folderModels.map((model) => (
                                  <Box
                                    key={model.id}
                                    onClick={() => handleOptionsToggleSelection(model.id)}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 2,
                                      p: 1.5,
                                      borderRadius: 1,
                                      border: 1,
                                      borderColor: selectedOptions.has(model.id)
                                        ? "primary.main"
                                        : "divider",
                                      cursor: "pointer",
                                      "&:hover": { borderColor: "primary.light" },
                                    }}
                                  >
                                    <Checkbox
                                      checked={selectedOptions.has(model.id)}
                                      onChange={() => handleOptionsToggleSelection(model.id)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <Box
                                      component="img"
                                      src={model.previewPath}
                                      alt=""
                                      sx={{ width: 48, height: 48, objectFit: "contain", borderRadius: 1 }}
                                    />
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography variant="body2" noWrap fontWeight={600}>
                                        {model.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {model.typeName}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            </AccordionDetails>
                          </Accordion>
                        );
                      })}
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowImportOptionsModal(false)}>Cancel</Button>
                  <Button
                    variant="contained"
                    onClick={handleImportChoice}
                    disabled={selectedOptions.size === 0}
                  >
                    Import {selectedOptions.size > 0 ? `(${selectedOptions.size})` : ""}
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Delete Confirmation Modal */}
              <Dialog
                open={deleteConfirmState.isOpen}
                onClose={() =>
                  setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
                }
                aria-labelledby="delete-confirm-title"
                maxWidth="xs"
                fullWidth
              >
                <DialogTitle id="delete-confirm-title" sx={{ textAlign: "center", pb: 1 }}>
                  <Stack alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        bgcolor: "error.dark",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.9,
                      }}
                    >
                      <AlertTriangle className="w-6 h-6 text-red-300" />
                    </Box>
                    <Typography variant="h6" component="span">
                      Confirm deletion
                    </Typography>
                  </Stack>
                </DialogTitle>
                <DialogContent>
                  <DialogContentText sx={{ textAlign: "center" }}>
                    {deleteConfirmState.type === "single" &&
                      "Are you sure you want to delete this model? This action cannot be undone."}
                    {deleteConfirmState.type === "bulk" &&
                      `Are you sure you want to delete ${selectedIds.size} models? This action cannot be undone.`}
                    {deleteConfirmState.type === "folder" &&
                      "Are you sure you want to delete this folder?"}
                  </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                  <Button
                    onClick={() =>
                      setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
                    }
                    variant="outlined"
                    fullWidth
                  >
                    Cancel
                  </Button>
                  <Button onClick={executeDelete} color="error" variant="contained" fullWidth>
                    Delete
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={showGroupModal}
                onClose={() => setShowGroupModal(false)}
                aria-labelledby="print-group-dialog-title"
                fullWidth
                maxWidth="xs"
              >
                <DialogTitle id="print-group-dialog-title">
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Boxes className="w-4 h-4" />
                      <Typography variant="h6" component="span">
                        Create print group
                      </Typography>
                    </Stack>
                    <IconButton
                      onClick={() => setShowGroupModal(false)}
                      aria-label="Close print group dialog"
                      size="small"
                    >
                      <X className="w-4 h-4" />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>
                    Keep {selectedIds.size} selected model{selectedIds.size === 1 ? "" : "s"} together
                    without merging their files.
                  </DialogContentText>
                  <form id="print-group-form" onSubmit={handleGroupSubmit}>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      value={groupMode}
                      onChange={(_, v) => v && setGroupMode(v)}
                      size="small"
                      sx={{ mb: 2 }}
                    >
                      <ToggleButton value="new">New group</ToggleButton>
                      <ToggleButton value="existing" disabled={modelGroups.length === 0}>
                        Existing group
                      </ToggleButton>
                    </ToggleButtonGroup>

                    {groupMode === "new" ? (
                      <TextField
                        id="print-group-name"
                        autoFocus
                        required
                        fullWidth
                        label="Group name"
                        placeholder="e.g. Desk organizer"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                      />
                    ) : (
                      <TextField
                        id="existing-print-group"
                        select
                        required
                        fullWidth
                        label="Print group"
                        value={targetGroupId}
                        onChange={(e) => setTargetGroupId(e.target.value)}
                        SelectProps={{ native: true }}
                      >
                        {modelGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </TextField>
                    )}
                  </form>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowGroupModal(false)}>Cancel</Button>
                  <Button
                    type="submit"
                    form="print-group-form"
                    variant="contained"
                    disabled={groupMode === "new" ? !groupName.trim() : !targetGroupId}
                  >
                    Save group
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={showMoveModal}
                onClose={() => setShowMoveModal(false)}
                aria-labelledby="move-dialog-title"
                fullWidth
                maxWidth="xs"
              >
                <DialogTitle id="move-dialog-title">
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FolderInput className="w-4 h-4" />
                      <Typography variant="h6" component="span">
                        Move to folder
                      </Typography>
                    </Stack>
                    <IconButton onClick={() => setShowMoveModal(false)} aria-label="Close move dialog" size="small">
                      <X className="w-4 h-4" />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={0.5}>
                    {folders.map((folder) => (
                      <Button
                        key={folder.id}
                        onClick={() => handleBulkMoveSubmit(folder.id)}
                        fullWidth
                        sx={{ justifyContent: "flex-start", textTransform: "none" }}
                      >
                        {folder.name}
                      </Button>
                    ))}
                  </Stack>
                </DialogContent>
              </Dialog>

              <Dialog
                open={showTagModal}
                onClose={() => setShowTagModal(false)}
                aria-labelledby="tag-dialog-title"
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle id="tag-dialog-title">
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Tags className="w-4 h-4" />
                      <Typography variant="h6" component="span">
                        Add tags
                      </Typography>
                    </Stack>
                    <IconButton onClick={() => setShowTagModal(false)} aria-label="Close tag dialog" size="small">
                      <X className="w-4 h-4" />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>
                    Add tags to {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} (comma
                    separated):
                  </DialogContentText>
                  <Box component="form" id="bulk-tag-form" onSubmit={handleBulkTagSubmit}>
                    <TextField
                      autoFocus
                      fullWidth
                      size="small"
                      placeholder="scifi, armor, weapon..."
                      value={bulkTags}
                      onChange={(e) => setBulkTags(e.target.value)}
                    />
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowTagModal(false)}>Cancel</Button>
                  <Button type="submit" form="bulk-tag-form" variant="contained">
                    Add tags
                  </Button>
                </DialogActions>
              </Dialog>
            </main>
          </>
        )}
        <Snackbar
          open={!port ? true : false}
          autoHideDuration={6000}
          message="API Host Not Set"
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error" variant="filled" sx={{ width: "100%" }}>
            API Host Not Set
          </Alert>
        </Snackbar>
      </div>
    </ThemeProvider>
  );
};

export default App;
