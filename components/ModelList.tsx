import React, { useRef, useState } from 'react';
import { UploadCloud, FileBox, Calendar, Tag, MoreVertical } from 'lucide-react';
import { STLModel } from '../types';

interface ModelListProps {
  models: STLModel[];
  onUpload: (files: FileList) => void;
  onSelectModel: (model: STLModel) => void;
  selectedModelId: string | null;
}

const ModelList: React.FC<ModelListProps> = ({ models, onUpload, onSelectModel, selectedModelId }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            <UploadCloud className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white">Drop STL files here</h2>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Model Library</h2>
          <p className="text-slate-400 text-sm">{models.length} items</p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" />
          Upload STL
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept=".stl"
          multiple
        />
      </div>

      {/* Grid */}
      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 border-2 border-dashed border-vault-700 rounded-xl">
          <FileBox className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">This folder is empty</p>
          <p className="text-sm">Drag and drop STL files to upload</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {models.map((model) => (
            <div
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={`group bg-vault-900 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                selectedModelId === model.id ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-vault-700 hover:border-vault-600'
              }`}
            >
              <div className="aspect-square bg-vault-800 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                 {/* Placeholder preview for grid, in real app could be a thumbnail rendered from Three.js */}
                 <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-gradient-to-tr from-blue-900/40 to-transparent" />
                 <FileBox className="w-12 h-12 text-slate-600 group-hover:text-blue-400 transition-colors" />
                 
                 {/* Badges */}
                 <div className="absolute top-2 right-2 flex gap-1">
                    {model.tags.slice(0, 1).map(tag => (
                        <span key={tag} className="text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {tag}
                        </span>
                    ))}
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
