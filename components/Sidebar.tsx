
import React, { useState, useMemo } from 'react';
import { Folder as FolderIcon, Plus, Box, LayoutGrid, Pencil, Trash2, Check, X } from 'lucide-react';
import { Folder, STLModel, StorageStats } from '../types';

interface SidebarProps {
  folders: Folder[];
  models: STLModel[];
  currentFolderId: string;
  storageStats: StorageStats;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveToFolder: (folderId: string, modelIds: string[]) => void;
  onUploadToFolder: (folderId: string, files: FileList) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  folders, 
  models,
  currentFolderId,
  storageStats,
  onSelectFolder, 
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  onUploadToFolder
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Renaming State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Drag and Drop State
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    models.forEach(m => {
      counts[m.folderId] = (counts[m.folderId] || 0) + 1;
    });
    return counts;
  }, [models]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreating(false);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingId && editName.trim()) {
      onRenameFolder(editingId, editName.trim());
      setEditingId(null);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, folderId: string, count: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (count > 0) {
        alert("Folder must be empty to delete.");
        return;
    }
    
    onDeleteFolder(folderId);
  };

  // Drag Handlers
  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragTargetId !== folderId) {
      setDragTargetId(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we are just moving to a child element
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTargetId(null);
    
    // Check for Files first (Upload to folder)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadToFolder(folderId, e.dataTransfer.files);
      return;
    }

    // Check for internal move (Move existing cards to folder)
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const { modelIds } = JSON.parse(data);
        if (Array.isArray(modelIds) && modelIds.length > 0) {
          onMoveToFolder(folderId, modelIds);
        }
      }
    } catch (err) {
      console.error("Failed to process drop", err);
    }
  };

  // Format Storage Display
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const percentUsed = storageStats.total > 0 
    ? Math.min((storageStats.used / storageStats.total) * 100, 100) 
    : 0;

  return (
    <div className="w-64 bg-vault-900 border-r border-vault-700 flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Box className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">STL Vault</h1>
      </div>

      <div className="px-4 mb-4">
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-vault-800 hover:bg-vault-700 text-slate-200 py-2 px-4 rounded-md transition-colors border border-vault-700"
        >
          <Plus className="w-4 h-4" />
          <span>New Folder</span>
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="px-4 mb-4">
          <input
            autoFocus
            type="text"
            className="w-full bg-vault-900 border border-blue-500 rounded px-3 py-2 text-sm text-white focus:outline-none"
            placeholder="Folder Name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => setIsCreating(false)}
          />
        </form>
      )}

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        <button
          onClick={() => onSelectFolder('all')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors group ${
            currentFolderId === 'all' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-vault-800 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium flex-1 text-left">All Models</span>
          <span className="text-xs text-slate-600 group-hover:text-slate-500">{models.length}</span>
        </button>

        <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Folders
        </div>
        
        {folders.map(folder => {
          const count = folderCounts[folder.id] || 0;
          const isEditing = editingId === folder.id;
          const isDropTarget = dragTargetId === folder.id;

          return (
            <div key={folder.id} className="relative group">
              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="px-2 py-1">
                   <div className="flex items-center gap-1 bg-vault-900 border border-blue-500 rounded px-2 py-1">
                      <input
                        autoFocus
                        type="text"
                        className="w-full bg-transparent text-sm text-white focus:outline-none min-w-0"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && handleCancelEdit(e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button type="submit" className="text-green-500 hover:text-green-400"><Check className="w-3 h-3" /></button>
                      <button type="button" onClick={handleCancelEdit} className="text-red-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                   </div>
                </form>
              ) : (
                <div
                  className={`w-full flex items-center rounded-md transition-all duration-200 group/item relative ${
                    isDropTarget 
                      ? 'bg-blue-600/40 text-blue-200 ring-1 ring-blue-400 scale-[1.02]' 
                      : currentFolderId === folder.id 
                        ? 'bg-blue-600/20 text-blue-400' 
                        : 'text-slate-400 hover:bg-vault-800 hover:text-slate-200'
                  }`}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, folder.id)}
                >
                  {/* Clickable selection area */}
                  <div 
                    className="flex-1 flex items-center gap-3 px-3 py-2 cursor-pointer min-w-0"
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <FolderIcon className={`w-4 h-4 shrink-0 ${isDropTarget ? 'animate-bounce' : ''}`} />
                    <span className="text-sm font-medium truncate select-none pointer-events-none">{folder.name}</span>
                  </div>
                  
                  {/* Hover Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity px-1 relative z-10">
                    <button 
                      type="button"
                      onClick={(e) => handleStartEdit(e, folder)}
                      className="p-1 hover:bg-vault-700 rounded text-slate-500 hover:text-blue-400 focus:outline-none"
                      title="Rename Folder"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => handleDeleteClick(e, folder.id, count)}
                      className={`p-1 rounded focus:outline-none ${
                        count > 0 
                          ? 'text-slate-700 cursor-not-allowed' 
                          : 'hover:bg-vault-700 text-slate-500 hover:text-red-400'
                      }`}
                      title={count > 0 ? "Folder must be empty to delete" : "Delete Folder"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div 
                    className="px-3 py-2 cursor-pointer"
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <span className={`text-xs ${currentFolderId === folder.id ? 'text-blue-500' : 'text-slate-600'} w-6 text-right block pointer-events-none`}>{count}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-vault-700">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3">
          <p className="text-xs text-white/80 font-medium mb-1">Storage Used</p>
          <div className="w-full bg-black/20 rounded-full h-1.5 mb-2 overflow-hidden">
            <div 
              className="bg-white h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${percentUsed}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-white/60 flex justify-between">
             <span>{formatSize(storageStats.used)}</span>
             <span>{formatSize(storageStats.total)}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
