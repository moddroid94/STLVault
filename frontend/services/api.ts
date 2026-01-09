import { Folder, STLModel, StorageStats, STLModelCollection } from "../types";
import { v4 as uuidv4 } from "uuid";

let API_BASE_URL = "";

if (localStorage.getItem("api-port-override")) {
  API_BASE_URL = localStorage.getItem("api-port-override") + "/api";
} else {
  const url = import.meta.env.VITE_APP_API + "/api";
  API_BASE_URL = url;
}

// --- API SERVICE ---

export const api = {
  // 1. GET Folders
  getFolders: async (): Promise<Folder[]> => {
    const res = await fetch(`${API_BASE_URL}/folders`);
    if (!res.ok) throw new Error("Failed to fetch folders");
    return res.json();
  },

  // 2. CREATE Folder
  createFolder: async (
    name: string,
    parentId: string | null = null
  ): Promise<Folder> => {
    const res = await fetch(`${API_BASE_URL}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
    if (!res.ok) throw new Error("Failed to create folder");
    return res.json();
  },

  // 3. UPDATE Folder (Rename/Move)
  updateFolder: async (id: string, name: string): Promise<Folder> => {
    const res = await fetch(`${API_BASE_URL}/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  },

  // 4. DELETE Folder
  deleteFolder: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/folders/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Delete failed");
  },

  // 5. GET Models
  getModels: async (folderId?: string): Promise<STLModel[]> => {
    const query = folderId && folderId !== "all" ? `?folderId=${folderId}` : "";
    const res = await fetch(`${API_BASE_URL}/models${query}`);
    if (!res.ok) throw new Error("Failed to fetch models");
    return res.json();
  },

  // 6. UPLOAD Model
  uploadModel: async (
    file: File,
    folderId: string,
    thumbnail?: string,
    tags: string[] = []
  ): Promise<STLModel> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId);
    if (thumbnail) formData.append("thumbnail", thumbnail); // Send base64 thumbnail
    if (tags.length > 0) formData.append("tags", JSON.stringify(tags));

    const res = await fetch(`${API_BASE_URL}/models/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  // 7. UPDATE Model
  updateModel: async (
    id: string,
    updates: Partial<STLModel>
  ): Promise<STLModel> => {
    const res = await fetch(`${API_BASE_URL}/models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  },

  // 8. DELETE Model
  deleteModel: async (id: string): Promise<void> => {
    console.log("API: Deleting model", id);

    const res = await fetch(`${API_BASE_URL}/models/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Delete failed");
  },

  // 9. GET Download URL
  getDownloadUrl: (model: STLModel) => {
    return `${API_BASE_URL}/models/${model.id}/download`;
  },

  //9b. GET slicer Weblink
  getSlicerUrl: (model: STLModel) => {
    const modelURL = `${API_BASE_URL}/models/${model.id}/download`;

    // Get user's preferred slicer from localStorage
    const slicerPreference =
      localStorage.getItem("stlvault-slicer") || "orcaslicer";

    const slicerProtocols: Record<string, string> = {
      orcaslicer: "orcaslicer://open?file=",
      prusaslicer: "prusaslicer://open?file=",
      bambu: "bambustudio://open?file=",
      cura: "cura://open?file=",
    };

    const protocol =
      slicerProtocols[slicerPreference] || slicerProtocols["orcaslicer"];
    return `${protocol}${modelURL}`;
  },

  // 10. BULK DELETE
  bulkDeleteModels: async (ids: string[]): Promise<void> => {
    console.log("API: Bulk deleting models", ids);

    const res = await fetch(`${API_BASE_URL}/models/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error("Bulk delete failed");
  },

  // 11. BULK MOVE
  bulkMoveModels: async (ids: string[], folderId: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/models/bulk-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, folderId }),
    });
    if (!res.ok) throw new Error("Bulk move failed");
  },

  // 12. BULK TAG
  bulkAddTags: async (ids: string[], tags: string[]): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/models/bulk-tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, tags }),
    });
    if (!res.ok) throw new Error("Bulk tag failed");
  },

  // 13. RETRIEVE MODEL OPTIONS
  retrieveModelOptions: async (url: string): Promise<STLModelCollection[]> => {
    const res = await fetch(`${API_BASE_URL}/printables/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error("Import failed");
    return res.json();
  },

  // 13. IMPORT FROM URL
  importModelFromId: async (
    id: string,
    name: string,
    parentId: string,
    previewPath: string,
    folderId: string,
    typeName: string,
  ): Promise<STLModel> => {
    const res = await fetch(`${API_BASE_URL}/printables/importid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, parentId, previewPath, folderId, typeName }),
    });
    if (!res.ok) throw new Error("Import failed");
    return res.json();
  },

  // 14. REPLACE FILE
  replaceModelFile: async (
    id: string,
    file: File,
    thumbnail?: string
  ): Promise<STLModel> => {
    const formData = new FormData();
    formData.append("file", file);
    if (thumbnail) formData.append("thumbnail", thumbnail);

    const res = await fetch(`${API_BASE_URL}/models/${id}/file`, {
      method: "PUT",
      body: formData,
    });
    if (!res.ok) throw new Error("File replacement failed");
    return res.json();
  },

  // 14a. REPLACE FILE
  replaceModelThumbnail: async (
    id: string,
    file: File,
  ): Promise<STLModel> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/models/${id}/thumbnail`, {
      method: "PUT",
      body: formData,
    });
    if (!res.ok) throw new Error("File replacement failed");
    return res.json();
  },

  // 15. GET Storage Stats
  getStorageStats: async (): Promise<StorageStats> => {
    const res = await fetch(`${API_BASE_URL}/storage-stats`);
    if (!res.ok) throw new Error("Failed to fetch storage stats");
    return res.json();
  },
};
