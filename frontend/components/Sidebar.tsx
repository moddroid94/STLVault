
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Folder as FolderIcon, Plus, Box, LayoutGrid, Pencil, Trash2, Check, X, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import { Folder, STLModel, StorageStats } from '../types';


interface SidebarProps {
  folders: Folder[];
  models: STLModel[];
  currentFolderId: string;
  storageStats: StorageStats;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveToFolder: (folderId: string, modelIds: string[]) => void;
  onUploadToFolder: (folderId: string, files: FileList) => void;
}

// Helper component for recursive rendering
interface FolderNodeProps {
  folder: Folder;
  level: number;
  allFolders: Folder[];
  currentFolderId: string;
  expandedIds: Set<string>;
  editingId: string | null;
  dragTargetId: string | null;
  folderCounts: Record<string, number>;
  creatingSubfolderId: string | null;
  // Callbacks
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, count: number, hasChildren: boolean) => void;
  onSetEditing: (id: string | null) => void;
  onSetCreatingSubfolder: (id: string | null) => void;
  onCreateSubfolder: (name: string, parentId: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  level,
  allFolders,
  currentFolderId,
  expandedIds,
  editingId,
  dragTargetId,
  folderCounts,
  creatingSubfolderId,
  onToggleExpand,
  onSelect,
  onRename,
  onDelete,
  onSetEditing,
  onSetCreatingSubfolder,
  onCreateSubfolder,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const [editName, setEditName] = useState(folder.name);
  const [subfolderName, setSubfolderName] = useState('');
  
  const children = allFolders.filter(f => f.parentId === folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isEditing = editingId === folder.id;
  const isCreatingChild = creatingSubfolderId === folder.id;
  const isDropTarget = dragTargetId === folder.id;
  const count = folderCounts[folder.id] || 0;
  const isSelected = currentFolderId === folder.id;

  // Reset edit name when starting edit
  React.useEffect(() => {
    if (isEditing) setEditName(folder.name);
  }, [isEditing, folder.name]);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editName.trim()) {
      onRename(folder.id, editName.trim());
      onSetEditing(null);
    }
  };

  const handleSubfolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (subfolderName.trim()) {
      onCreateSubfolder(subfolderName.trim(), folder.id);
      setSubfolderName('');
      onSetCreatingSubfolder(null);
      // Ensure we are expanded to see the new child
      if (!isExpanded) onToggleExpand(folder.id);
    }
  };

  return (
    <div>
      {/* Folder Row */}
      <div 
        className={`relative group flex items-center pr-2 min-h-[36px] transition-colors
          ${isDropTarget 
             ? 'bg-blue-600/40 text-blue-200 ring-1 ring-blue-400' 
             : isSelected 
               ? 'bg-blue-600/20 text-blue-400' 
               : 'text-slate-400 hover:bg-vault-800 hover:text-slate-200'
          }
        `}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onDragOver={(e) => onDragOver(e, folder.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, folder.id)}
      >
        {/* Expand Toggle */}
        <div 
           className="w-5 h-5 flex items-center justify-center shrink-0 cursor-pointer hover:text-white mr-1"
           onClick={(e) => {
             e.stopPropagation();
             onToggleExpand(folder.id);
           }}
        >
          {hasChildren ? (
             isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : (
             // Placeholder to keep alignment
             <div className="w-3 h-3" />
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <form onSubmit={handleRenameSubmit} className="flex-1 flex items-center gap-1 min-w-0 mr-2">
             <input
               autoFocus
               type="text"
               className="w-full bg-vault-900 border border-blue-500 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none min-w-0"
               value={editName}
               onChange={(e) => setEditName(e.target.value)}
               onClick={(e) => e.stopPropagation()}
               onKeyDown={(e) => e.key === 'Escape' && onSetEditing(null)}
             />
             <button type="submit" className="text-green-500 hover:text-green-400 p-1"><Check className="w-3 h-3" /></button>
             <button type="button" onClick={() => onSetEditing(null)} className="text-red-500 hover:text-red-400 p-1"><X className="w-3 h-3" /></button>
          </form>
        ) : (
          <>
            <div 
              className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer py-1.5"
              onClick={() => onSelect(folder.id)}
            >
              {isExpanded || isDropTarget ? <FolderOpen className="w-4 h-4 shrink-0" /> : <FolderIcon className="w-4 h-4 shrink-0" />}
              <span className="text-sm font-medium truncate select-none">{folder.name}</span>
            </div>

            {/* Hover Actions */}
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 bg-vault-900/50 backdrop-blur-sm rounded px-1">
               <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      onSetCreatingSubfolder(folder.id);
                      if (!isExpanded) onToggleExpand(folder.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-green-400 rounded hover:bg-vault-700"
                  title="New Subfolder"
               >
                  <Plus className="w-3 h-3" />
               </button>
               <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      onSetEditing(folder.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-blue-400 rounded hover:bg-vault-700"
                  title="Rename"
               >
                  <Pencil className="w-3 h-3" />
               </button>
               <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      onDelete(folder.id, count, hasChildren);
                  }}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-vault-700"
                  title="Delete"
               >
                  <Trash2 className="w-3 h-3" />
               </button>
            </div>

            {/* Count Badge */}
            <span className={`text-xs ml-2 ${isSelected ? 'text-blue-500' : 'text-slate-600'} min-w-[1.5rem] text-right`}>
              {count}
            </span>
          </>
        )}
      </div>

      {/* New Subfolder Input */}
      {isCreatingChild && (
         <div 
           className="flex items-center pr-2 py-1"
           style={{ paddingLeft: `${(level + 1) * 16 + 32}px` }}
         >
            <form onSubmit={handleSubfolderSubmit} className="flex-1 flex items-center gap-1 animate-in slide-in-from-left-2 fade-in duration-200">
                <FolderIcon className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                    autoFocus
                    type="text"
                    placeholder="Subfolder Name"
                    className="w-full bg-vault-900 border border-blue-500 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none min-w-0"
                    value={subfolderName}
                    onChange={(e) => setSubfolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && onSetCreatingSubfolder(null)}
                />
                <button type="submit" className="text-green-500 hover:text-green-400 p-1"><Check className="w-3 h-3" /></button>
                <button type="button" onClick={() => onSetCreatingSubfolder(null)} className="text-red-500 hover:text-red-400 p-1"><X className="w-3 h-3" /></button>
            </form>
         </div>
      )}

      {/* Children */}
      {isExpanded && (
        <div className="flex flex-col">
          {children.map(child => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              expandedIds={expandedIds}
              editingId={editingId}
              dragTargetId={dragTargetId}
              folderCounts={folderCounts}
              creatingSubfolderId={creatingSubfolderId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onSetEditing={onSetEditing}
              onSetCreatingSubfolder={onSetCreatingSubfolder}
              onCreateSubfolder={onCreateSubfolder}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  
  // State for tree interactions
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingSubfolderId, setCreatingSubfolderId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  // Resize state
  const [width, setWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Limit width between 200px and 600px
      const newWidth = Math.min(Math.max(e.clientX, 200), 600);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Add grabbing cursor to body during resize
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Calculate direct counts only (not recursive, matching file system behavior usually)
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    models.forEach(m => {
      counts[m.folderId] = (counts[m.folderId] || 0) + 1;
    });
    return counts;
  }, [models]);

  // Ensure parents of current folder are expanded
  React.useEffect(() => {
      if (currentFolderId && currentFolderId !== 'all') {
          const expandPath = (id: string, path: Set<string>) => {
              const folder = folders.find(f => f.id === id);
              if (folder && folder.parentId) {
                  path.add(folder.parentId);
                  expandPath(folder.parentId, path);
              }
          };
          
          setExpandedIds(prev => {
              const next = new Set<string>(prev);
              expandPath(currentFolderId, next);
              return next;
          });
      }
  }, [currentFolderId, folders]);

  const handleCreateRootSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRootName.trim()) {
      onCreateFolder(newRootName.trim(), null);
      setNewRootName('');
      setIsCreatingRoot(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteRequest = (id: string, count: number, hasChildren: boolean) => {
    if (count > 0 || hasChildren) {
        alert("Folder must be empty to delete (no files and no subfolders).");
        return;
    }
    onDeleteFolder(id);
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

  // Root folders
  const rootFolders = folders.filter(f => f.parentId === null);

  return (
    <div 
      className="bg-vault-900 border-r border-vault-700 flex flex-col h-full select-none relative shrink-0 group/sidebar"
      style={{ width }}
      onDragLeave={() => setDragTargetId(null)}
    >
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
          <Box className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight truncate">STL Vault v{process.env.REACT_APP_TAG}</h1>
      </div>

      <div className="px-4 mb-4">
        <button
          onClick={() => setIsCreatingRoot(true)}
          className="w-full flex items-center justify-center gap-2 bg-vault-800 hover:bg-vault-700 text-slate-200 py-2 px-4 rounded-md transition-colors border border-vault-700 shadow-sm overflow-hidden"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="truncate">New Root Folder</span>
        </button>
      </div>

      {isCreatingRoot && (
        <form onSubmit={handleCreateRootSubmit} className="px-4 mb-4 animate-in slide-in-from-top-2 fade-in duration-200">
           <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                className="w-full bg-vault-900 border border-blue-500 rounded px-3 py-2 text-sm text-white focus:outline-none shadow-sm"
                placeholder="Folder Name..."
                value={newRootName}
                onChange={(e) => setNewRootName(e.target.value)}
                onBlur={() => !newRootName.trim() && setIsCreatingRoot(false)}
                onKeyDown={(e) => e.key === 'Escape' && setIsCreatingRoot(false)}
              />
           </div>
        </form>
      )}

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-vault-700 scrollbar-track-transparent">
        <button
          onClick={() => onSelectFolder('all')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors group mb-2 ${
            currentFolderId === 'all' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-vault-800 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium flex-1 text-left truncate">All Models</span>
          <span className="text-xs text-slate-600 group-hover:text-slate-500 shrink-0">{models.length}</span>
        </button>

        <div className="pt-2 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
          <span>Library</span>
        </div>
        
        <div className="space-y-1 pb-4">
            {rootFolders.map(folder => (
              <FolderNode
                key={folder.id}
                folder={folder}
                level={0}
                allFolders={folders}
                currentFolderId={currentFolderId}
                expandedIds={expandedIds}
                editingId={editingId}
                dragTargetId={dragTargetId}
                folderCounts={folderCounts}
                creatingSubfolderId={creatingSubfolderId}
                onToggleExpand={toggleExpand}
                onSelect={onSelectFolder}
                onRename={onRenameFolder}
                onDelete={handleDeleteRequest}
                onSetEditing={setEditingId}
                onSetCreatingSubfolder={setCreatingSubfolderId}
                onCreateSubfolder={onCreateFolder}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            ))}
        </div>
      </nav>

      <div className="p-4 border-t border-vault-700 bg-vault-900 z-10">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-white/80 font-medium mb-1 truncate">Storage Used</p>
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

      {/* Resizer Handle */}
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-50 ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={startResizing}
      />
    </div>
  );
};

export default Sidebar;
