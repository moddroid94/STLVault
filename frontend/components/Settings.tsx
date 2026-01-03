import React, { useState, useEffect } from "react";
import {
  Check,
  ChevronLeft,
  EthernetPort,
  SettingsIcon,
  TicketIcon,
  Wrench,
  X,
} from "lucide-react";
import { bool } from "three/tsl";

interface SettingsProps {
  onBack: () => void;
}

type SlicerType = "orcaslicer" | "prusaslicer" | "bambu" | "cura";

interface SlicerConfig {
  name: string;
  protocol: string;
}

const SLICERS: Record<SlicerType, SlicerConfig> = {
  orcaslicer: { name: "OrcaSlicer", protocol: "orcaslicer://open?file=" },
  prusaslicer: { name: "PrusaSlicer", protocol: "prusaslicer://open?file=" },
  bambu: { name: "Bambu Studio", protocol: "bambustudio://open?file=" },
  cura: { name: "Cura", protocol: "cura://open?file=" },
};

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [apiPortStatus, setApiPortStatus] = useState(false);
  // Initialize state directly from localStorage to prevent flash
  const [selectedSlicer, setSelectedSlicer] = useState<SlicerType>(() => {
    const saved = localStorage.getItem("stlvault-slicer");
    return saved && saved in SLICERS ? (saved as SlicerType) : "orcaslicer";
  });

  const [selectedApiPort, setSelectedApiPort] = useState<string>(() => {
    const envport = import.meta.env.VITE_APP_API;
    const port = localStorage.getItem("api-port-override");
    if (port) {
      setApiPortStatus(true);
    }
    return port ? port : envport;
  });

  // Save slicer preference to localStorage when changed
  const handleSlicerChange = (slicer: SlicerType) => {
    setSelectedSlicer(slicer);
    localStorage.setItem("stlvault-slicer", slicer);
  };

  // Save API port preference to localStorage when changed
  const handleApiPortChange = (port: string) => {
    setSelectedApiPort(port);
  };

  const handleApiForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApiPort) return;

    localStorage.setItem("api-port-override", selectedApiPort);
    setApiPortStatus(true);
  };

  return (
    <div className="flex-1 p-4 sm:p-8 h-full overflow-y-auto bg-vault-800 relative flex flex-col">
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
            <p className="text-sm text-slate-400">
              Configure your STL Vault preferences
            </p>
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
            Choose which slicer application to open when clicking "Open in
            Slicer" button
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(SLICERS) as SlicerType[]).map((slicer) => (
              <button
                key={slicer}
                onClick={() => handleSlicerChange(slicer)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedSlicer === slicer
                    ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                    : "border-vault-700 bg-vault-800 hover:border-vault-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">
                    {SLICERS[slicer].name}
                  </span>
                  {selectedSlicer === slicer && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {SLICERS[slicer].protocol}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 p-4 bg-vault-800 rounded-lg border border-vault-700">
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Note:</span> Your
              slicer application must be installed and configured to handle
              protocol links (e.g., {SLICERS[selectedSlicer].protocol}). The
              exact setup varies by slicer and operating system.
            </p>
          </div>
        </div>

        {/* Api Settings*/}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <EthernetPort className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">API Host</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">Choose the API Host URL</p>
          <div className="mt-4 p-4 bg-vault-800 rounded-lg border border-vault-700 mb-4 ">
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Note:</span> The
              URL set here will override the one in the ENV variables.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <form onSubmit={handleApiForm}>
              <div className="grid grid-cols-2 mb-4">
                <label className="block col-span-2 text-sm font-medium text-slate-400 mb-1">
                  API URL
                </label>
                <input
                  autoFocus
                  type="string"
                  required
                  className="col-span-2 w-full bg-vault-900 border border-vault-700 rounded-md px-3 py-2 text-white focus:border-indigo-500 outline-none placeholder:text-slate-600"
                  placeholder="http://0.0.0.0:8989"
                  value={selectedApiPort}
                  onChange={(e) => handleApiPortChange(e.target.value)}
                />

                <p className="col-span-2 w-full text-xs text-slate-500 mt-1">
                  Insert the port at which the API is served.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!selectedApiPort}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set
                </button>
                {apiPortStatus ? (
                  <Check className="flex text-green-400 rounded-full bg-vault-800 my-auto"></Check>
                ) : (
                  <X className="flex text-red-400 rounded-full bg-vault-800 my-auto"></X>
                )}
              </div>
            </form>
          </div>

          
        </div>
      </div>
    </div>
  );
};

export default Settings;
