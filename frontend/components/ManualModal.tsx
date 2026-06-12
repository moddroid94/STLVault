import React, { useEffect, useState } from "react";
import { X, Edit, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Tooltip from "@mui/material/Tooltip";

import { STLModel } from "../types";
import { api } from "../services/api";
import { useVisualViewport } from "../hooks/useVisualViewport";
import "./styles/manual.css";

type ManualMode = "view" | "edit";

interface ManualModalProps {
  model: STLModel | null;
  onClose: () => void;
  initialMode?: ManualMode;
  onSave: (id: string, file: File) => Promise<unknown>;
}

const ManualModal: React.FC<ManualModalProps> = ({
  model,
  onClose,
  initialMode = "view",
  onSave,
}) => {
  const visualViewport = useVisualViewport();
  const [mode, setMode] = useState<ManualMode>(initialMode);
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!model) return;
    setMode(initialMode);
    setError("");
    setContent("");
    setDraft("");

    if (!model.manual) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(api.getManualUrl(model))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load manual");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setDraft(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load manual");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [model?.id]);

  useEffect(() => {
    if (!model) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [model, onClose]);

  if (!model) return null;

  const viewportHeight =
    visualViewport.height ||
    (typeof window !== "undefined" ? window.innerHeight : 0);

  const handleSave = async () => {
    if (!model || saving) return;
    setSaving(true);
    setError("");
    try {
      const filename = model.manual || "manual.md";
      const file = new File([draft], filename, { type: "text/markdown" });
      await onSave(model.id, file);
      setContent(draft);
      setMode("view");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save manual",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!model.manual) {
      onClose();
      return;
    }
    setDraft(content);
    setMode("view");
  };

  return (
    <div
      className="fixed left-0 top-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4"
      style={{
        width: "100%",
        height: viewportHeight,
        transform: `translate(${visualViewport.offsetLeft}px, ${visualViewport.offsetTop}px)`,
      }}
      onClick={mode === "edit" ? undefined : onClose}
    >
      <div
        className="bg-vault-800 border border-vault-600 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col w-full max-w-3xl"
        style={{ maxHeight: Math.max(240, viewportHeight - 32) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-3 p-5 border-b border-vault-700 sticky top-0 bg-vault-800 rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white truncate">
              {model.name}
            </h3>
            {mode === "view" ? (
              <Tooltip title="Edit manual">
                <button
                  onClick={() => setMode("edit")}
                  className="text-slate-400 hover:text-white shrink-0 p-1 rounded hover:bg-vault-700"
                  aria-label="Edit manual"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-vault-700 disabled:text-slate-500 text-white rounded transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-vault-700 hover:bg-vault-600 disabled:opacity-50 text-slate-200 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white shrink-0"
            aria-label="Close manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1 min-h-0 flex flex-col">
          {loading && (
            <p className="text-sm text-slate-400 italic">Loading manual...</p>
          )}
          {!loading && error && (
            <p className="text-sm text-red-400 mb-3">{error}</p>
          )}
          {!loading && mode === "view" && !error && (
            <article className="manual-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          )}
          {!loading && mode === "edit" && (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write your manual in Markdown..."
              className="flex-1 min-h-[240px] w-full bg-vault-900 border border-vault-700 rounded-md p-3 text-slate-200 font-mono text-sm resize-none outline-none focus:border-blue-500 overflow-y-auto"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualModal;
