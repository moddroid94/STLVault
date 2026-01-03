
// Vite environment variables type declaration
declare global {
  interface ImportMeta {
    env: {
      VITE_APP_TAG: string;
      [key: string]: any;
    };
  }
  
  const __APP_VERSION__: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  icon?: string;
}

export interface STLModel {
  id: string;
  name: string;
  folderId: string;
  url: string; // Blob URL
  size: number;
  dateAdded: number;
  tags: string[];
  description: string;
  dimensions?: { x: number; y: number; z: number };
  thumbnail?: string;
}

export interface STLModelCollection {
  parentId: string;
  id: string;
  name: string;
  folder: string | null;
  previewPath: string;
  typeName: string;
}

export interface StorageStats {
  used: number;
  total: number;
}

export enum ViewMode {
  GRID = 'GRID',
  LIST = 'LIST',
}

export type AppState = {
  folders: Folder[];
  models: STLModel[];
  currentFolderId: string;
  selectedModelId: string | null;
  sidebarOpen: boolean;
};