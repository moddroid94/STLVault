export interface Folder {
  id: string;
  name: string;
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
