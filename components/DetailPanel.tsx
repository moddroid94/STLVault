
import React, { useState, useCallback, useRef } from 'react';
import { STLModel } from '../types';
import Viewer3D from './Viewer3D';
import { X, Download, Tag as TagIcon, Sparkles, Save, Edit, Trash2, Calendar, HardDrive, FileUp, RefreshCw } from 'lucide-react';
import { generateMetadataForFile } from '../services/geminiService';
import { generateThumbnail } from '../services/thumbnailGenerator';
import { api } from '../services/api';

interface DetailPanelProps {
  model: STLModel | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<STLModel>) => void;
  onDelete: (id: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ model, onClose, onUpdate, onDelete }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset local state when model changes
  React.useEffect(() => {
    if (model) {
      setEditName(model.name);
      setEditDesc(model.description || '');
      setEditTags(model.tags.join(', '));
      setIsEditing(false);
    }
  }, [model]);

  const handleModelLoaded = useCallback((dimensions: { x: number; y: number; z: number }) => {
    if (model && !model.dimensions) {
      onUpdate(model.id, { dimensions });
    }
  }, [model, onUpdate]);

  if (!model) return null;

  const handleAutoTag = async () => {
    setIsGenerating(true);
    try {
      const metadata = await generateMetadataForFile(model.name);
      onUpdate(model.id, {
        tags: [...new Set([...model.tags, ...metadata.tags])],
        description: metadata.description || model.description
      });
      // Update local state if editing
      setEditTags(prev => {
        const current = prev.split(',').map(t => t.trim()).filter(Boolean);
        return [...new Set([...current, ...metadata.tags])].join(', ');
      });
      if (!editDesc) setEditDesc(metadata.description);
      
    } catch (e) {
      console.error("Auto-tag failed", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;
    
    setIsReplacing(true);
    try {
        // Generate thumbnail
        let thumb: string | undefined;
        try {
            thumb = await generateThumbnail(file);
        } catch(err) {
            console.warn("Thumbnail failed", err);
        }

        const updated = await api.replaceModelFile(model.id, file, thumb);
        onUpdate(model.id, {
            url: updated.url,
            size: updated.size,
            thumbnail: updated.thumbnail
        });
        // Note: The name and other metadata are preserved unless the user explicitly changes them in the text fields
    } catch(e) {
        console.error("Failed to replace", e);
        alert("Failed to replace file");
    } finally {
        setIsReplacing(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    const newTags = editTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    onUpdate(model.id, {
      name: editName,
      description: editDesc,
      tags: newTags
    });
    setIsEditing(false);
  };

  return (
    <div className="w-96 bg-vault-900 border-l border-vault-700 flex flex-col h-full shadow-2xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-vault-700 flex justify-between items-center">
        <h3 className="font-semibold text-white">Model Details</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-vault-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Viewer */}
        <div className="aspect-square bg-black rounded-lg border border-vault-700 overflow-hidden shadow-inner">
          <Viewer3D url={model.url} filename={model.name} onLoaded={handleModelLoaded} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a 
            href={api.getDownloadUrl(model)} 
            download={model.name}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
          <button 
             onClick={handleAutoTag}
             disabled={isGenerating}
             className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-md flex items-center justify-center transition-colors disabled:opacity-50"
             title="Auto-generate tags with AI"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Info Form */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
             <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Metadata</label>
             {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                    <Edit className="w-3 h-3" /> Edit
                </button>
             )}
          </div>

          <div className="space-y-3">
             {/* Quick Stats Grid */}
             <div className="grid grid-cols-2 gap-3 p-3 bg-vault-800 rounded-lg border border-vault-700/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>Added</span>
                    </div>
                    <p className="text-xs font-medium text-slate-200">
                        {new Date(model.dateAdded).toLocaleDateString()}
                    </p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <HardDrive className="w-3 h-3" />
                        <span>File Size</span>
                    </div>
                    <p className="text-xs font-medium text-slate-200">
                        {(model.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                </div>
             </div>
            
             {/* File Replacement Section (Edit Mode Only) */}
             {isEditing && (
                 <div className="pb-3 border-b border-vault-700 mb-3">
                     <span className="text-xs text-slate-500 block mb-1">Source File</span>
                     <div className="flex items-center gap-2">
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isReplacing}
                            className="flex items-center gap-2 bg-vault-800 border border-vault-600 hover:bg-vault-700 text-slate-300 px-3 py-2 rounded-md text-xs font-medium transition-colors w-full justify-center"
                         >
                            {isReplacing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />}
                            {isReplacing ? "Uploading..." : "Replace 3D Model File"}
                         </button>
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".stl,.step,.stp,.3mf"
                            onChange={handleReplaceFile}
                         />
                     </div>
                     <p className="text-[10px] text-slate-500 mt-1 text-center">Replaces geometry but keeps name/desc unless changed.</p>
                 </div>
             )}

             <div>
                <span className="text-xs text-slate-500 block mb-1">Filename</span>
                {isEditing ? (
                    <input 
                        className="w-full bg-vault-800 border border-vault-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                    />
                ) : (
                    <p className="text-sm text-slate-200 break-all">{model.name}</p>
                )}
             </div>

             <div>
                <span className="text-xs text-slate-500 block mb-1">Description</span>
                {isEditing ? (
                    <textarea 
                        className="w-full bg-vault-800 border border-vault-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none min-h-[80px]"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Add a description..."
                    />
                ) : (
                    <p className="text-sm text-slate-300 leading-relaxed text-sm">
                        {model.description || <span className="text-slate-600 italic">No description</span>}
                    </p>
                )}
             </div>

             <div>
                <span className="text-xs text-slate-500 block mb-1">Tags</span>
                {isEditing ? (
                    <input 
                        className="w-full bg-vault-800 border border-vault-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="scifi, armor, character..."
                    />
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {model.tags.length > 0 ? model.tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 text-xs bg-vault-800 border border-vault-700 text-slate-300 px-2 py-1 rounded-full">
                                <TagIcon className="w-3 h-3 opacity-50" />
                                {tag}
                            </span>
                        )) : <span className="text-slate-600 italic text-sm">No tags</span>}
                    </div>
                )}
             </div>

             {isEditing && (
                 <div className="flex gap-2 pt-2">
                     <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1">
                         <Save className="w-3 h-3" /> Save Changes
                     </button>
                     <button onClick={() => setIsEditing(false)} className="flex-1 bg-vault-700 hover:bg-vault-600 text-slate-200 py-1.5 rounded text-xs font-medium">
                         Cancel
                     </button>
                 </div>
             )}
          </div>
        </div>
        
        <div className="pt-6 border-t border-vault-700 mt-auto">
             <button onClick={() => onDelete(model.id)} className="w-full border border-red-900/50 text-red-500 hover:bg-red-900/20 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                 <Trash2 className="w-4 h-4" /> Delete Model
             </button>
        </div>
      </div>
    </div>
  );
};

export default DetailPanel;
