import React, { useState } from 'react';
import { STLModel } from '../types';
import Viewer3D from './Viewer3D';
import { X, Download, Tag as TagIcon, Sparkles, Save, Edit3, Trash2 } from 'lucide-react';
import { generateMetadataForFile } from '../services/geminiService';

interface DetailPanelProps {
  model: STLModel | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<STLModel>) => void;
  onDelete: (id: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ model, onClose, onUpdate, onDelete }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');

  // Reset local state when model changes
  React.useEffect(() => {
    if (model) {
      setEditName(model.name);
      setEditDesc(model.description || '');
      setEditTags(model.tags.join(', '));
      setIsEditing(false);
    }
  }, [model]);

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
          <Viewer3D url={model.url} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a 
            href={model.url} 
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
                    <Edit3 className="w-3 h-3" /> Edit
                </button>
             )}
          </div>

          <div className="space-y-3">
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
