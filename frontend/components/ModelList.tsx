
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { CloudUpload, FileBox, Search, ArrowUpDown, CheckSquare, Square, MoreVertical, Trash2, ExternalLink, Download, Globe, Folder as FolderIcon } from 'lucide-react';
import { STLModel, Folder } from '../types';
import { api } from '../services/api';

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

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

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
  onUploadToFolder
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [activeMenuModelId, setActiveMenuModelId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuModelId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0;
    setIsTouchDevice(Boolean(isTouch));
  }, []);

  const processedModels = useMemo(() => {
    let result = [...models];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(query) || 
        m.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return b.dateAdded - a.dateAdded;
        case 'date-asc': return a.dateAdded - b.dateAdded;
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'size-desc': return b.size - a.size;
        case 'size-asc': return a.size - b.size;
        default: return 0;
      }
    });

    return result;
  }, [models, searchQuery, sortBy]);

  const processedFolders = useMemo(() => {
      let result = [...folders];
      if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          result = result.filter(f => f.name.toLowerCase().includes(query));
      }
      // Always sort folders by name
      result.sort((a, b) => a.name.localeCompare(b.name));
      return result;
  }, [folders, searchQuery]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drag overlay if dragging files, not elements
    if (e.dataTransfer.types.includes('Files')) {
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
      const data = e.dataTransfer.getData('application/json');
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
    const idsToMove = selectedIds.has(modelId) ? Array.from(selectedIds) : [modelId];
    
    e.dataTransfer.setData('application/json', JSON.stringify({ modelIds: idsToMove }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const selectionMode = selectedIds.size > 0;

  return (
    <div
      className="flex-1 p-4 sm:p-8 h-full overflow-y-auto bg-vault-800 relative flex flex-col"
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
            <h2 className="text-2xl font-bold text-white">Drop 3D files here</h2>
            <p className="text-blue-200 mt-2">Supported: STL, STEP, 3MF</p>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Model Library</h2>
            <p className="text-slate-400 text-sm">
              {processedModels.length} {processedModels.length === 1 ? 'item' : 'items'}
              {models.length !== processedModels.length && ` (filtered from ${models.length})`}
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
              <p className="text-sm">Drag and drop STL or STEP files to upload</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-6 pb-24">
          
          {/* Render Folders First */}
          {processedFolders.map(folder => (
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
                    ${dragOverFolderId === folder.id ? 'border-blue-400 bg-blue-900/10 ring-1 ring-blue-400' : 'border-vault-700 hover:border-vault-600 hover:bg-vault-800/50'}
                  `}
              >
                  <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-500 group-hover:text-blue-400 group-hover:scale-110 transition-all shrink-0">
                      <FolderIcon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                      <h3 className="font-semibold text-slate-200 truncate group-hover:text-white">{folder.name}</h3>
                      <p className="text-xs text-slate-500">Folder</p>
                  </div>
                  {dragOverFolderId === folder.id && (
                      <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />
                  )}
              </div>
          ))}

          {/* Render Models */}
          {processedModels.map((model) => {
            const isSelected = selectedIds.has(model.id);
            const isMenuOpen = activeMenuModelId === model.id;
            
            return (
              <div
                key={model.id}
                draggable={true}
                onDragStart={(e) => handleCardDragStart(e, model.id)}
                style={{ zIndex: isMenuOpen ? 20 : 'auto' }}
                onClick={() => {
                    if (selectionMode) {
                        onToggleSelection(model.id);
                    } else {
                        onSelectModel(model);
                    }
                }}
                className={`group bg-vault-900 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 relative active:cursor-grabbing ${
                  isSelected || selectedModelId === model.id ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-vault-700 hover:border-vault-600'
                }`}
              >
                {/* Selection Checkbox */}
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelection(model.id);
                    }}
                    className={`absolute top-4 left-4 z-10 rounded bg-vault-900/80 backdrop-blur-sm transition-opacity duration-200 p-1
                    ${isSelected || selectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                     {isSelected ? <CheckSquare className="w-5 h-5 text-blue-500" /> : <Square className="w-5 h-5 text-slate-400 hover:text-white" />}
                </div>

                <div className="aspect-square bg-vault-800 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden pointer-events-none">
                   {/* Thumbnail or Placeholder */}
                   {model.thumbnail ? (
                      <img 
                        src={model.thumbnail} 
                        alt={model.name} 
                        className="w-full h-full object-contain p-2 opacity-80 group-hover:opacity-100 transition-opacity" 
                      />
                   ) : (
                      <>
                        <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-gradient-to-tr from-blue-900/40 to-transparent" />
                        <FileBox className="w-12 h-12 text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </>
                   )}
                   
                   {/* Badges */}
                   <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[80%]">
                      {model.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded-full backdrop-blur-sm truncate max-w-full">
                              {tag}
                          </span>
                      ))}
                      {model.tags.length > 2 && (
                         <span className="text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                           +{model.tags.length - 2}
                         </span>
                      )}
                   </div>
                   
                   {/* File Type Badge */}
                   <div className="absolute bottom-2 left-2">
                      <span className="text-[10px] bg-blue-600/80 text-white px-1.5 py-0.5 rounded uppercase font-bold shadow-sm">
                        {model.name.split('.').pop()}
                      </span>
                   </div>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-200 truncate mb-1" title={model.name}>{model.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                          {(model.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                          {new Date(model.dateAdded).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuModelId(isMenuOpen ? null : model.id);
                        }}
                        className="text-slate-500 hover:text-white p-1 rounded hover:bg-vault-800 transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-vault-800 border border-vault-600 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectModel(model);
                                    setActiveMenuModelId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-vault-700 hover:text-white flex items-center gap-2"
                            >
                                <ExternalLink className="w-3 h-3" /> Open
                            </button>

                            <a 
                                href={api.getDownloadUrl(model)} 
                                download={model.name}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuModelId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-vault-700 hover:text-white flex items-center gap-2"
                            >
                                <Download className="w-3 h-3" /> Download
                            </a>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Call delete FIRST to ensure propagation isn't cut off by component unmounting if list updates
                                    onDelete(model.id);
                                    setActiveMenuModelId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2"
                            >
                                <Trash2 className="w-3 h-3" /> Delete
                            </button>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModelList;
