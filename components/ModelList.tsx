import React, { useRef, useState, useMemo } from 'react';
import { CloudUpload, FileBox, Calendar, Tag, MoreVertical, Search, ArrowUpDown } from 'lucide-react';
import { STLModel } from '../types';

interface ModelListProps {
  models: STLModel[];
  onUpload: (files: FileList) => void;
  onSelectModel: (model: STLModel) => void;
  selectedModelId: string | null;
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

const ModelList: React.FC<ModelListProps> = ({ models, onUpload, onSelectModel, selectedModelId }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  return (
    <div 
      className="flex-1 p-8 h-full overflow-y-auto bg-vault-800 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-600/20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center backdrop-blur-sm m-4 rounded-xl">
          <div className="text-center">
            <CloudUpload className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white">Drop 3D files here</h2>
            <p className="text-blue-200 mt-2">Supported: STL, STEP</p>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Model Library</h2>
            <p className="text-slate-400 text-sm">
              {processedModels.length} {processedModels.length === 1 ? 'item' : 'items'}
              {models.length !== processedModels.length && ` (filtered from ${models.length})`}
            </p>
          </div>
          
          <div className="flex gap-3">
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
              accept=".stl,.step,.stp"
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
      {processedModels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500 border-2 border-dashed border-vault-700 rounded-xl bg-vault-900/30">
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
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {processedModels.map((model) => (
            <div
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={`group bg-vault-900 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                selectedModelId === model.id ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-vault-700 hover:border-vault-600'
              }`}
            >
              <div className="aspect-square bg-vault-800 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                 {/* Placeholder preview for grid */}
                 <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-gradient-to-tr from-blue-900/40 to-transparent" />
                 <FileBox className="w-12 h-12 text-slate-600 group-hover:text-blue-400 transition-colors" />
                 
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
                    <span className="text-[10px] bg-blue-600/80 text-white px-1.5 py-0.5 rounded uppercase font-bold">
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
                <button className="text-slate-500 hover:text-white p-1 rounded hover:bg-vault-800">
                    <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelList;