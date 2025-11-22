
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ModelList from './components/ModelList';
import DetailPanel from './components/DetailPanel';
import { STLModel, Folder } from './types';
import { generateThumbnail } from './services/thumbnailGenerator';
import { api } from './services/api';
import { FolderInput, Tags, X, Trash2, AlertTriangle } from 'lucide-react';

const App = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [models, setModels] = useState<STLModel[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('all');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<number>(0);

  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [bulkTags, setBulkTags] = useState('');

  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk' | 'folder';
    id?: string;
  }>({ isOpen: false, type: 'single' });

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedFolders, fetchedModels] = await Promise.all([
          api.getFolders(),
          api.getModels('all') // Fetch all initially
        ]);
        setFolders(fetchedFolders);
        setModels(fetchedModels);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter models based on selection
  const filteredModels = currentFolderId === 'all' 
    ? models 
    : models.filter(m => m.folderId === currentFolderId);

  // Clear selection when changing folders to avoid confusion
  useEffect(() => {
     setSelectedIds(new Set());
  }, [currentFolderId]);

  const selectedModel = models.find(m => m.id === selectedModelId) || null;

  const handleCreateFolder = async (name: string) => {
    try {
      const newFolder = await api.createFolder(name);
      setFolders(prev => [...prev, newFolder]);
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    try {
      await api.updateFolder(id, newName);
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    } catch (error) {
      console.error("Failed to rename folder", error);
    }
  };

  const handleDeleteFolder = (id: string) => {
    const hasModels = models.some(m => m.folderId === id);
    if (hasModels) {
      alert("Folder must be empty to delete.");
      return;
    }
    setDeleteConfirmState({ isOpen: true, type: 'folder', id });
  };

  const handleUpload = async (fileList: FileList) => {
    const files = Array.from(fileList);
    setUploadQueue(prev => prev + files.length);
    
    for (const file of files) {
      try {
        let thumbnail: string | undefined = undefined;
        if (file.name.toLowerCase().endsWith('.stl')) {
           try {
             thumbnail = await generateThumbnail(file);
           } catch (e) {
             console.warn("Thumbnail generation failed, uploading without thumbnail");
           }
        }

        const targetFolderId = currentFolderId === 'all' && folders.length > 0 ? folders[0].id : currentFolderId;
        const newModel = await api.uploadModel(file, targetFolderId, thumbnail);
        
        setModels(prev => [newModel, ...prev]);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      } finally {
        setUploadQueue(prev => prev - 1);
      }
    }
  };

  const handleUpdateModel = async (id: string, updates: Partial<STLModel>) => {
    try {
      setModels(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
      await api.updateModel(id, updates);
    } catch (error) {
      console.error("Failed to update model:", error);
    }
  };

  const handleDeleteModel = (id: string) => {
    console.log("Opening delete confirmation for model:", id);
    setDeleteConfirmState({ isOpen: true, type: 'single', id });
  };

  const handleBulkDelete = () => {
    console.log("Opening bulk delete confirmation for:", selectedIds);
    setDeleteConfirmState({ isOpen: true, type: 'bulk' });
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmState;
    console.log(`Executing delete type: ${type}, id: ${id}`);
    
    try {
      if (type === 'single' && id) {
        await api.deleteModel(id);
        setModels(prev => prev.filter(m => m.id !== id));
        if (selectedModelId === id) setSelectedModelId(null);
      } 
      else if (type === 'bulk') {
        const ids = Array.from(selectedIds) as string[];
        await api.bulkDeleteModels(ids);
        setModels(prev => prev.filter(m => !ids.includes(m.id)));
        setSelectedIds(new Set());
        if (selectedModelId && ids.includes(selectedModelId)) setSelectedModelId(null);
      } 
      else if (type === 'folder' && id) {
        await api.deleteFolder(id);
        setFolders(prev => prev.filter(f => f.id !== id));
        if (currentFolderId === id) setCurrentFolderId('all');
      }
    } catch (error) {
      console.error("Delete operation failed:", error);
      alert("Failed to delete. Please check console.");
    } finally {
      setDeleteConfirmState(prev => ({ ...prev, isOpen: false }));
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

  const handleSelectAll = () => {
    if (selectedIds.size === filteredModels.length) {
        setSelectedIds(new Set());
    } else {
        const allIds = filteredModels.map(m => m.id);
        setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkMoveSubmit = async (targetFolderId: string) => {
     try {
        const ids = Array.from(selectedIds) as string[];
        await api.bulkMoveModels(ids, targetFolderId);
        setModels(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, folderId: targetFolderId } : m));
        setShowMoveModal(false);
        setSelectedIds(new Set());
     } catch (e) {
        console.error("Bulk move failed", e);
     }
  };

  const handleBulkTagSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
         const ids = Array.from(selectedIds) as string[];
         const tags = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
         await api.bulkAddTags(ids, tags);
         setModels(prev => prev.map(m => {
             if (selectedIds.has(m.id)) {
                 return { ...m, tags: [...new Set([...m.tags, ...tags])] };
             }
             return m;
         }));
         setShowTagModal(false);
         setSelectedIds(new Set());
      } catch (err) {
          console.error("Bulk tag failed", err);
      }
  };

  return (
    <div className="flex h-screen bg-vault-900 text-slate-200 font-sans selection:bg-blue-500/30">
      <Sidebar 
        folders={folders} 
        models={models}
        currentFolderId={currentFolderId}
        onSelectFolder={(id) => {
            setCurrentFolderId(id);
            setSelectedModelId(null);
        }}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />
      
      <main className="flex-1 flex overflow-hidden relative">
        {isLoading ? (
           <div className="absolute inset-0 flex items-center justify-center bg-vault-900 z-50">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
           </div>
        ) : (
          <ModelList 
            models={filteredModels} 
            onUpload={handleUpload}
            onSelectModel={(m) => setSelectedModelId(m.id)}
            onDelete={handleDeleteModel}
            selectedModelId={selectedModelId}
            // Selection Props
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onSelectAll={handleSelectAll}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}

        {/* Upload Indicator */}
        {uploadQueue > 0 && (
           <div className="absolute bottom-6 left-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-pulse">
             <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
             <span className="text-sm font-medium">Uploading {uploadQueue} file(s)...</span>
           </div>
        )}

        {/* Slide-over panel */}
        <div className={`absolute top-0 right-0 h-full transition-transform duration-300 ease-in-out transform ${selectedModelId ? 'translate-x-0' : 'translate-x-full'} z-30`}>
          <DetailPanel 
            model={selectedModel} 
            onClose={() => setSelectedModelId(null)}
            onUpdate={handleUpdateModel}
            onDelete={handleDeleteModel}
          />
        </div>

        {/* Floating Action Bar - Moved to App to ensure it is top-level Z-index */}
        {selectedIds.size > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-vault-800 border border-vault-600 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 duration-200">
            <div className="flex items-center gap-2 border-r border-vault-600 pr-4">
                <span className="font-bold text-white">{selectedIds.size}</span>
                <span className="text-slate-400 text-sm">selected</span>
                <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowMoveModal(true)}
                    className="p-2 rounded-full hover:bg-vault-700 text-slate-300 hover:text-blue-400 transition-colors flex items-center gap-2"
                    title="Move Selected"
                >
                    <FolderInput className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Move</span>
                </button>
                
                <button 
                    onClick={() => {
                        setBulkTags('');
                        setShowTagModal(true);
                    }}
                    className="p-2 rounded-full hover:bg-vault-700 text-slate-300 hover:text-purple-400 transition-colors flex items-center gap-2"
                    title="Tag Selected"
                >
                    <Tags className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Tag</span>
                </button>
                
                <button 
                    onClick={handleBulkDelete}
                    className="p-2 rounded-full hover:bg-vault-700 text-slate-300 hover:text-red-400 transition-colors flex items-center gap-2"
                    title="Delete Selected"
                >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Delete</span>
                </button>
            </div>
            </div>
        )}

        {/* Modals Layer */}
        
        {/* Delete Confirmation Modal */}
        {deleteConfirmState.isOpen && (
            <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-vault-800 border border-vault-600 rounded-xl p-6 w-96 shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Confirm Deletion</h3>
                        <p className="text-slate-400 text-sm">
                            {deleteConfirmState.type === 'single' && "Are you sure you want to delete this model? This action cannot be undone."}
                            {deleteConfirmState.type === 'bulk' && `Are you sure you want to delete ${selectedIds.size} models? This action cannot be undone.`}
                            {deleteConfirmState.type === 'folder' && "Are you sure you want to delete this folder?"}
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setDeleteConfirmState(prev => ({ ...prev, isOpen: false }))}
                            className="flex-1 py-2.5 rounded-lg bg-vault-700 hover:bg-vault-600 text-slate-200 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeDelete}
                            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showMoveModal && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-vault-800 border border-vault-600 rounded-xl p-6 w-80 shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><FolderInput className="w-4 h-4" /> Move to Folder</h3>
                        <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                        {folders.map(folder => (
                            <button 
                                key={folder.id}
                                onClick={() => handleBulkMoveSubmit(folder.id)}
                                className="w-full text-left px-3 py-2 rounded hover:bg-vault-700 text-slate-300 hover:text-white text-sm transition-colors"
                            >
                                {folder.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {showTagModal && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-vault-800 border border-vault-600 rounded-xl p-6 w-96 shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><Tags className="w-4 h-4" /> Add Tags</h3>
                        <button onClick={() => setShowTagModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <form onSubmit={handleBulkTagSubmit}>
                        <p className="text-sm text-slate-400 mb-2">Add tags to {selectedIds.size} items (comma separated):</p>
                        <input 
                            autoFocus
                            type="text"
                            className="w-full bg-vault-900 border border-vault-700 rounded-md px-3 py-2 text-white focus:border-blue-500 outline-none mb-4"
                            placeholder="scifi, armor, weapon..."
                            value={bulkTags}
                            onChange={(e) => setBulkTags(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowTagModal(false)} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
                            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded">Add Tags</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;
