
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Wrench } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

type SlicerType = 'orcaslicer' | 'prusaslicer' | 'bambu' | 'cura';

interface SlicerConfig {
  name: string;
  protocol: string;
}

const SLICERS: Record<SlicerType, SlicerConfig> = {
  orcaslicer: { name: 'OrcaSlicer', protocol: 'orcaslicer://open?file=' },
  prusaslicer: { name: 'PrusaSlicer', protocol: 'prusaslicer://open?file=' },
  bambu: { name: 'Bambu Studio', protocol: 'bambustudio://open?file=' },
  cura: { name: 'Cura', protocol: 'cura://open?file=' }
};

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  // Initialize state directly from localStorage to prevent flash
  const [selectedSlicer, setSelectedSlicer] = useState<SlicerType>(() => {
    const saved = localStorage.getItem('stlvault-slicer');
    return (saved && saved in SLICERS) ? saved as SlicerType : 'orcaslicer';
  });

  // Save slicer preference to localStorage when changed
  const handleSlicerChange = (slicer: SlicerType) => {
    setSelectedSlicer(slicer);
    localStorage.setItem('stlvault-slicer', slicer);
  };

  return (
    <div 
      className="flex-1 p-4 sm:p-8 h-full overflow-y-auto bg-vault-800 relative flex flex-col"
    >

      {/* Header Section */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-vault-700 hover:bg-vault-600 text-slate-300 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Settings</h2>
            <p className="text-sm text-slate-400">Configure your STL Vault preferences</p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 bg-vault-900/30 rounded-lg p-6 text-slate-300">
        {/* Slicer Settings */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Default Slicer</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Choose which slicer application to open when clicking "Open in Slicer" button
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(SLICERS) as SlicerType[]).map((slicer) => (
              <button
                key={slicer}
                onClick={() => handleSlicerChange(slicer)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedSlicer === slicer
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                    : 'border-vault-700 bg-vault-800 hover:border-vault-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{SLICERS[slicer].name}</span>
                  {selectedSlicer === slicer && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">{SLICERS[slicer].protocol}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 p-4 bg-vault-800 rounded-lg border border-vault-700">
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Note:</span> Your slicer application must be installed 
              and configured to handle protocol links (e.g., {SLICERS[selectedSlicer].protocol}). 
              The exact setup varies by slicer and operating system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
