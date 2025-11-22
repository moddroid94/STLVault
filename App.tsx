import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import ModelList from './components/ModelList';
import DetailPanel from './components/DetailPanel';
import { STLModel, Folder } from './types';

// Mock Initial Data
const INITIAL_FOLDERS: Folder[] = [
  { id: '1', name: 'Characters' },
  { id: '2', name: 'Vehicles' },
  { id: '3', name: 'Terrain' },
];

const App = () => {
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS);
  const [models, setModels] = useState<STLModel[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('all');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Filter models based on selection
  const filteredModels = currentFolderId === 'all' 
    ? models 
    : models.filter(m => m.folderId === currentFolderId);

  const selectedModel = models.find(m => m.id === selectedModelId) || null;

  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = { id: uuidv4(), name };
    setFolders([...folders, newFolder]);
  };

  const handleUpload = (fileList: FileList) => {
    const newModels: STLModel[] = Array.from(fileList).map(file => ({
      id: uuidv4(),
      name: file.name,
      folderId: currentFolderId === 'all' ? '1' : currentFolderId, // Default to first folder if in 'all'
      url: URL.createObjectURL(file),
      size: file.size,
      dateAdded: Date.now(),
      tags: [],
      description: ''
    }));
    setModels(prev => [...prev, ...newModels]);
  };

  const handleUpdateModel = (id: string, updates: Partial<STLModel>) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDeleteModel = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
    if (selectedModelId === id) setSelectedModelId(null);
  };

  return (
    <div className="flex h-screen bg-vault-900 text-slate-200 font-sans selection:bg-blue-500/30">
      <Sidebar 
        folders={folders} 
        currentFolderId={currentFolderId}
        onSelectFolder={(id) => {
            setCurrentFolderId(id);
            setSelectedModelId(null);
        }}
        onCreateFolder={handleCreateFolder}
      />
      
      <main className="flex-1 flex overflow-hidden relative">
        <ModelList 
          models={filteredModels} 
          onUpload={handleUpload}
          onSelectModel={(m) => setSelectedModelId(m.id)}
          selectedModelId={selectedModelId}
        />

        {/* Slide-over panel */}
        <div className={`absolute top-0 right-0 h-full transition-transform duration-300 ease-in-out transform ${selectedModelId ? 'translate-x-0' : 'translate-x-full'}`}>
          <DetailPanel 
            model={selectedModel} 
            onClose={() => setSelectedModelId(null)}
            onUpdate={handleUpdateModel}
            onDelete={handleDeleteModel}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
