import React, { useState, useRef, useEffect } from "react";
import {
  HistoryManager,
  getRelativeTime,
  type Version,
} from "../utils/HistoryManager";
import {
  Edit,
  FileText,
  Undo,
  Upload,
  Image as ImageIcon,
  ChevronDown,
} from "lucide-react";

interface HeaderProps {
  onSave: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportImage: () => void;
  pageNumber: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pdfId: string;
  onRestore: (data: any) => void;
  fileName: string;
}

export const Header = ({
  onSave,
  onUpload,
  onExportImage,
  pageNumber,
  totalPages,
  onPageChange,
  pdfId,
  onRestore,
  fileName,
}: HeaderProps) => {
  const [showVersions, setShowVersions] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Click outside logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        versionsRef.current &&
        !versionsRef.current.contains(event.target as Node)
      ) {
        setShowVersions(false);
      }
      if (
        exportRef.current &&
        !exportRef.current.contains(event.target as Node)
      ) {
        setShowExport(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShowVersions = () => {
    if (!showVersions && pdfId) {
      const v = HistoryManager.getVersions(pdfId);
      setVersions(v);
    }
    setShowVersions(!showVersions);
    if (showExport) setShowExport(false);
  };

  const handleRestore = (v: Version) => {
    if (
      window.confirm(
        `Restore to v${v.versionNumber} (${v.label})? This will load that version's state and you can continue editing.`
      )
    ) {
      onRestore(v.data);
      setShowVersions(false);
    }
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(e.currentTarget.value);
      if (!isNaN(val) && val >= 1 && val <= totalPages) {
        onPageChange(val);
      }
    }
  };

  return (
    <div className="w-full h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50 relative">
      <div className="flex items-center gap-4">
        {/* OPEN BUTTON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onUpload}
          accept="application/pdf"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg font-medium transition-colors"
        >
          <Upload size={18} className="text-blue-500" />
          <span className="text-sm">Open</span>
        </button>

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex items-center gap-2">
          <FileText size={20} className="text-blue-600" />
          <span className="font-medium text-gray-900 truncate max-w-[200px]">
            {fileName}
          </span>
          <Edit
            size={16}
            className="text-gray-400 cursor-pointer hover:text-blue-500"
          />
        </div>
      </div>

      {/* CENTER: Pagination */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
          <span className="text-xs text-gray-500 uppercase font-semibold">
            Page
          </span>
          <input
            type="number"
            min={1}
            max={totalPages}
            defaultValue={pageNumber}
            key={pageNumber}
            onKeyDown={handlePageInput}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= totalPages) {
                onPageChange(val);
              }
            }}
            className="w-12 text-center text-sm bg-transparent text-gray-900 font-bold focus:outline-none"
          />
          <span className="text-sm text-gray-500">of {totalPages}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Versions Dropdown */}
        <div className="relative" ref={versionsRef}>
          <button
            onClick={handleShowVersions}
            className={`px-3 py-2 rounded-lg font-medium flex items-center gap-1 transition-all ${
              showVersions
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            title="Version History"
          >
            <Undo
              size={16}
              className={showVersions ? "text-blue-600" : "text-blue-500"}
            />
            <span className="text-sm">Restore</span>
          </button>

          <div
            className={`absolute top-full right-0 mt-2 w-72 bg-white border border-gray-100 shadow-2xl rounded-2xl z-50 overflow-hidden transition-all duration-200 origin-top-right ${
              showVersions
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Version History
              </span>
              {versions.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("Clear all history for this PDF?")) {
                      HistoryManager.clearHistory(pdfId);
                      setVersions([]);
                      setShowVersions(false);
                    }
                  }}
                  className="text-[11px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wider transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[350px] overflow-y-auto py-1 custom-scrollbar">
              {versions.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Undo size={18} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    No versions saved yet
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Versions are created during export
                  </p>
                </div>
              ) : (
                versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleRestore(v)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group flex items-start gap-3"
                  >
                    <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate flex items-center justify-between">
                        <span>
                          v{v.versionNumber} – {v.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                        {getRelativeTime(v.timestamp)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* EXPORT DROPDOWN */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => {
              setShowExport(!showExport);
              if (showVersions) setShowVersions(false);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] ${
              showExport
                ? "bg-blue-700 text-white shadow-blue-500/20"
                : "bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02]"
            }`}
          >
            <span className="text-sm">Export</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${
                showExport ? "rotate-180" : ""
              }`}
            />
          </button>

          <div
            className={`absolute top-full right-0 mt-2 w-64 bg-white border border-gray-100 shadow-2xl rounded-2xl z-50 overflow-hidden transition-all duration-200 origin-top-right ${
              showExport
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  onSave();
                  setShowExport(false);
                }}
                className="w-full text-left p-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    Download PDF
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    Flattened with annotations
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportImage();
                  setShowExport(false);
                }}
                className="w-full text-left p-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <ImageIcon size={20} className="text-purple-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    Download Image
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    Current page as PNG
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
