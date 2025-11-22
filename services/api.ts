
import { Folder, STLModel } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Set this to FALSE to use a real backend server
const USE_MOCK_API = true;
const API_BASE_URL = '/api';

// Mock Data Store (for demonstration without a real backend)
const getMockStore = () => {
  try {
    const stored = localStorage.getItem('stl-vault-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure structure integrity
      if (!parsed.folders) parsed.folders = [];
      if (!parsed.models) parsed.models = [];
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse mock store", e);
  }
  
  // Default initial state
  return {
    folders: [
      { id: '1', name: 'Characters' },
      { id: '2', name: 'Vehicles' },
      { id: '3', name: 'Terrain' },
    ],
    models: []
  };
};

const saveMockStore = (data: any) => {
  try {
    localStorage.setItem('stl-vault-store', JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save mock store", e);
  }
};

// --- API SERVICE ---

export const api = {
  // 1. GET Folders
  getFolders: async (): Promise<Folder[]> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 500)); // Simulate network delay
      return getMockStore().folders;
    }
    
    const res = await fetch(`${API_BASE_URL}/folders`);
    if (!res.ok) throw new Error('Failed to fetch folders');
    return res.json();
  },

  // 2. CREATE Folder
  createFolder: async (name: string): Promise<Folder> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 300));
      const store = getMockStore();
      const newFolder = { id: uuidv4(), name };
      store.folders.push(newFolder);
      saveMockStore(store);
      return newFolder;
    }

    const res = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    return res.json();
  },

  // 3. UPDATE Folder (Rename)
  updateFolder: async (id: string, name: string): Promise<Folder> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 200));
      const store = getMockStore();
      const index = store.folders.findIndex((f: Folder) => f.id === id);
      if (index === -1) throw new Error('Folder not found');
      store.folders[index].name = name;
      saveMockStore(store);
      return store.folders[index];
    }

    const res = await fetch(`${API_BASE_URL}/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Update failed');
    return res.json();
  },

  // 4. DELETE Folder
  deleteFolder: async (id: string): Promise<void> => {
    if (USE_MOCK_API) {
       await new Promise(r => setTimeout(r, 200));
       const store = getMockStore();
       // Check for models in folder
       const hasModels = store.models.some((m: STLModel) => m.folderId === id);
       if (hasModels) throw new Error('Cannot delete non-empty folder');
       
       store.folders = store.folders.filter((f: Folder) => f.id !== id);
       saveMockStore(store);
       return;
    }

    const res = await fetch(`${API_BASE_URL}/folders/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
  },

  // 5. GET Models
  getModels: async (folderId?: string): Promise<STLModel[]> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      const allModels = getMockStore().models;
      if (folderId && folderId !== 'all') {
        return allModels.filter((m: STLModel) => m.folderId === folderId);
      }
      return allModels;
    }

    const query = folderId && folderId !== 'all' ? `?folderId=${folderId}` : '';
    const res = await fetch(`${API_BASE_URL}/models${query}`);
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
  },

  // 6. UPLOAD Model
  uploadModel: async (file: File, folderId: string, thumbnail?: string): Promise<STLModel> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 1500)); // Simulate upload time
      
      const store = getMockStore();
      
      // In a real app, the server returns a URL. 
      // Here we simulate it with a blob URL (note: blobs don't persist well in localStorage, 
      // but this works for the session).
      const fakeUrl = URL.createObjectURL(file);
      
      const newModel: STLModel = {
        id: uuidv4(),
        name: file.name,
        folderId: folderId === 'all' ? '1' : folderId,
        url: fakeUrl,
        size: file.size,
        dateAdded: Date.now(),
        tags: [],
        description: '',
        thumbnail: thumbnail
      };

      store.models.push(newModel);
      saveMockStore(store);
      return newModel;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', folderId);
    if (thumbnail) formData.append('thumbnail', thumbnail); // Send base64 thumbnail

    const res = await fetch(`${API_BASE_URL}/models/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  // 7. UPDATE Model
  updateModel: async (id: string, updates: Partial<STLModel>): Promise<STLModel> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 200));
      const store = getMockStore();
      const index = store.models.findIndex((m: STLModel) => m.id === id);
      if (index === -1) throw new Error('Model not found');
      
      store.models[index] = { ...store.models[index], ...updates };
      saveMockStore(store);
      return store.models[index];
    }

    const res = await fetch(`${API_BASE_URL}/models/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Update failed');
    return res.json();
  },

  // 8. DELETE Model
  deleteModel: async (id: string): Promise<void> => {
    console.log("API: Deleting model", id);
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 300));
      const store = getMockStore();
      const initialCount = store.models.length;
      store.models = store.models.filter((m: STLModel) => m.id !== id);
      
      if (store.models.length === initialCount) {
        console.warn("API: Model ID not found in store during delete", id);
      }
      
      saveMockStore(store);
      return;
    }

    const res = await fetch(`${API_BASE_URL}/models/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed');
  },
  
  // 9. GET Download URL
  getDownloadUrl: (model: STLModel) => {
    if (USE_MOCK_API) return model.url;
    return `${API_BASE_URL}/models/${model.id}/download`;
  },

  // 10. BULK DELETE
  bulkDeleteModels: async (ids: string[]): Promise<void> => {
    console.log("API: Bulk deleting models", ids);
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const store = getMockStore();
      store.models = store.models.filter((m: STLModel) => !ids.includes(m.id));
      saveMockStore(store);
      return;
    }

    const res = await fetch(`${API_BASE_URL}/models/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Bulk delete failed');
  },

  // 11. BULK MOVE
  bulkMoveModels: async (ids: string[], folderId: string): Promise<void> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const store = getMockStore();
      store.models = store.models.map((m: STLModel) => 
        ids.includes(m.id) ? { ...m, folderId } : m
      );
      saveMockStore(store);
      return;
    }

    const res = await fetch(`${API_BASE_URL}/models/bulk-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, folderId }),
    });
    if (!res.ok) throw new Error('Bulk move failed');
  },

  // 12. BULK TAG
  bulkAddTags: async (ids: string[], tags: string[]): Promise<void> => {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const store = getMockStore();
      store.models = store.models.map((m: STLModel) => {
        if (ids.includes(m.id)) {
          const newTags = [...new Set([...m.tags, ...tags])];
          return { ...m, tags: newTags };
        }
        return m;
      });
      saveMockStore(store);
      return;
    }

    const res = await fetch(`${API_BASE_URL}/models/bulk-tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, tags }),
    });
    if (!res.ok) throw new Error('Bulk tag failed');
  }
};
