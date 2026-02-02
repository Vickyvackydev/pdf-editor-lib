import {
  Type,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  PenTool,
  Eraser,
  Highlighter,
  Shapes,
  Undo,
  Redo,
  ChevronDown,
  Plus,
  Upload,
  Pen,
  ArrowRight,
  Minus,
  Circle,
  Square,
  Check,
  X,
  Edit3,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import type { Textbox } from "fabric";

// Helper for transparent background
const removeBackground = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(imageSrc);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      // Simple white/light background removal
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // If pixel is close to white, make it transparent
        if (r > 230 && g > 230 && b > 230) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => resolve(imageSrc);
  });
};

interface ToolbarProps {
  activeTool: string;
  setActiveTool: (str: string) => void;
  selectedColor: string;
  setSelectedColor: (str: string) => void;
  fontSize: string;
  setFontSize: (str: string) => void;
  fontFamily?: string;
  setFontFamily?: (str: string) => void;
  handleAddText?: () => void;
  activateDrawMode: () => void;
  penColor?: string;
  setPenColor?: (color: string) => void;
  penSize?: number;
  setPenSize?: (size: number) => void;
  updateActiveText: (updates: Partial<Textbox>) => void;
  toggleTextStyle: (str: string) => void;
  activateHighlightMode: () => void;
  handleAddShape: (type: string) => void;
  handleAddImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addImageToCanvas: (url: string, options?: any) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFinishDrawing?: () => void;
  handleAddField: (type: string) => void;
  activateLinkMode: () => void;
  onEnterEditMode?: () => void;
}

export const Toolbar = ({
  activeTool,
  setActiveTool,
  selectedColor,
  setSelectedColor,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  handleAddText,
  activateDrawMode,

  updateActiveText,
  toggleTextStyle,
  activateHighlightMode,
  handleAddShape,

  addImageToCanvas,
  onUndo,
  onRedo,
  onFinishDrawing,
  handleAddField,
  activateLinkMode,
  setPenColor,
  setPenSize,
  penColor,
  penSize,
  onEnterEditMode,
}: ToolbarProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // History State
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const [recentSignatures, setRecentSignatures] = useState<string[]>([]);

  useEffect(() => {
    const savedImages = localStorage.getItem("recentImages");
    if (savedImages) setRecentImages(JSON.parse(savedImages));
    const savedSignatures = localStorage.getItem("recentSignatures");
    if (savedSignatures) setRecentSignatures(JSON.parse(savedSignatures));
  }, []);

  const addToRecent = (
    url: string,
    list: string[],
    setList: (l: string[]) => void,
    key: string,
  ) => {
    const newList = [url, ...list.filter((u) => u !== url)].slice(0, 5);
    setList(newList);
    localStorage.setItem(key, JSON.stringify(newList));
  };

  const deleteFromRecent = (
    url: string,
    list: string[],
    setList: (l: string[]) => void,
    key: string,
  ) => {
    const newList = list.filter((u) => u !== url);
    setList(newList);
    localStorage.setItem(key, JSON.stringify(newList));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      const data = f.target?.result as string;
      if (data) {
        addImageToCanvas(data);
        addToRecent(data, recentImages, setRecentImages, "recentImages");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setActiveDropdown(null);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result as string;
      if (data) {
        // Ask user or default to transparent?
        // For now, we'll process it and save both original and transparent in history?
        // Or just place it. User asked for option.
        // We'll simulate option by just doing it or asking in a future UI.
        // For this version, we'll auto-remove background as requested "give it a transparent background"
        const transparent = await removeBackground(data);

        // We can add the transparent one
        addImageToCanvas(transparent, { scaleX: 0.3, scaleY: 0.3 });

        // Add both to recent so user can choose original if they want
        addToRecent(
          data,
          recentSignatures,
          setRecentSignatures,
          "recentSignatures",
        );
        addToRecent(
          transparent,
          recentSignatures,
          setRecentSignatures,
          "recentSignatures",
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setActiveDropdown(null);
  };

  const toggleDropdown = (id: string) => {
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest(".toolbar-dropdown")) return;
      setActiveDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const colors = ["#000000", "#EF4444", "#3B82F6", "#10B981", "#F59E0B"];
  const fontOptions = [
    "Helvetica",
    "Arial",
    "Times New Roman",
    "Courier New",
    "Georgia",
  ];

  return (
    <div className="w-full bg-white border-b border-gray-200 px-2 py-1.5 flex items-center justify-between gap-2 shadow-sm z-40 relative">
      {/* Left Tools Group */}
      <div className="flex items-center gap-0.5">
        {/* TEXT TOOL */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => {
              setActiveTool("text");
              handleAddText?.();
              setActiveDropdown(activeDropdown === "text" ? null : "text");
            }}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTool === "text"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Type size={18} />
            <span className="text-sm font-medium">Text</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "text" && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 z-50">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Text Properties
              </div>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={fontFamily?.split(" ")[0] || "Arial"}
                  onChange={(e) => setFontFamily?.(e.target.value)}
                  className="flex-1 h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {fontOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize?.(e.target.value)}
                  className="w-20 h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {[8, 10, 12, 14, 16, 18, 24, 36, 48, 72].map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
                  <button
                    onClick={() => toggleTextStyle("fontWeight")}
                    className="p-1.5 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <span className="font-bold text-sm">B</span>
                  </button>
                  <button
                    onClick={() => toggleTextStyle("fontStyle")}
                    className="p-1.5 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <span className="italic text-sm">I</span>
                  </button>
                  <button
                    onClick={() => toggleTextStyle("underline")}
                    className="p-1.5 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <span className="underline text-sm">U</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  {colors.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        updateActiveText({ fill: c });
                        setSelectedColor(c);
                      }}
                      className={`w-6 h-6 rounded-full border border-gray-200 ${selectedColor === c ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* EDIT TEXT TOOL */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => {
              setActiveTool("edit");
              onEnterEditMode?.();
              setActiveDropdown(activeDropdown === "edit" ? null : "edit");
            }}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTool === "edit"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Edit3 size={18} />
            <span className="text-sm font-medium whitespace-nowrap">
              Edit Text
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "edit" && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 z-50">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Edit Text Properties
              </div>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={fontFamily?.split(" ")[0] || "Arial"}
                  onChange={(e) => {
                    const font = e.target.value;
                    setFontFamily?.(font);
                    updateActiveText?.({ fontFamily: font });
                  }}
                  className="flex-1 h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {fontOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select
                  value={fontSize}
                  onChange={(e) => {
                    const size = e.target.value;
                    setFontSize?.(size);
                    updateActiveText?.({ fontSize: Number(size) });
                  }}
                  className="w-20 h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {[8, 10, 12, 14, 16, 18, 24, 36, 48, 72].map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
                  <button
                    onClick={() => toggleTextStyle("fontWeight")}
                    className="p-1.5 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <span className="font-bold text-sm">B</span>
                  </button>
                  <button
                    onClick={() => toggleTextStyle("fontStyle")}
                    className="p-1.5 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <span className="italic text-sm">I</span>
                  </button>
                  <button
                    onClick={() => toggleTextStyle("underline")}
                    className="p-1.5 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <span className="underline text-sm">U</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  {colors.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        updateActiveText({ fill: c });
                        setSelectedColor(c);
                      }}
                      className={`w-6 h-6 rounded-full border border-gray-200 ${selectedColor === c ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LINKS */}
        <button
          onClick={() => {
            setActiveTool("link");
            activateLinkMode();
          }}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTool === "link"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <LinkIcon size={18} />
          <span className="text-sm font-medium whitespace-nowrap">Links</span>
        </button>

        {/* FORMS */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => toggleDropdown("forms")}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDropdown === "forms"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FileText size={18} />
            <span className="text-sm font-medium whitespace-nowrap">Forms</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "forms" && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => {
                  handleAddField("text");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Type size={16} /> Text Field
              </button>
              <button
                onClick={() => {
                  handleAddField("checkbox");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Check size={16} /> Checkbox
              </button>
              <button
                onClick={() => {
                  handleAddField("radio");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Circle size={16} /> Radio Button
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* IMAGES */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => toggleDropdown("image")}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDropdown === "image"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <ImageIcon size={18} />
            <span className="text-sm font-medium whitespace-nowrap">
              Images
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "image" && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Plus size={16} />
                </div>
                <div>
                  <div className="font-medium">New Image</div>
                  <div className="text-xs text-gray-400">
                    Upload from computer
                  </div>
                </div>
              </button>

              {recentImages.length > 0 && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Recent
                  </div>
                  <div className="grid grid-cols-4 gap-2 px-2">
                    {recentImages.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          addImageToCanvas(src);
                          setActiveDropdown(null);
                        }}
                        className="aspect-square rounded-lg border border-gray-200 overflow-hidden hover:border-blue-500 hover:ring-2 ring-blue-100 transition-all relative group bg-gray-50"
                      >
                        <img
                          src={src}
                          className="w-full h-full object-contain"
                          alt="recent"
                        />
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFromRecent(
                              src,
                              recentImages,
                              setRecentImages,
                              "recentImages",
                            );
                          }}
                          className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-100"
                        >
                          <X size={10} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* REDACT */}
        <button
          onClick={() => handleAddShape("redact")}
          className="px-2 py-1.5 text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-1.5"
        >
          <Square size={18} fill="black" />
          <span className="text-sm font-medium whitespace-nowrap">Redact</span>
        </button>

        {/* WHITEOUT */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => toggleDropdown("sign")}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDropdown === "sign"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <PenTool size={18} />
            <span className="text-sm font-medium whitespace-nowrap">Sign</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "sign" && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => signatureInputRef.current?.click()}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Upload size={16} />
                </div>
                <div>
                  <div className="font-medium">Upload Signature</div>
                  <div className="text-xs text-gray-400">
                    Auto-removes background
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTool("draw");
                  activateDrawMode();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <Pen size={16} />
                </div>
                <div>
                  <div className="font-medium">Draw Signature</div>
                  <div className="text-xs text-gray-400">
                    Use mouse or touch
                  </div>
                </div>
              </button>

              {recentSignatures.length > 0 && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Recent
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-2">
                    {recentSignatures.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          addImageToCanvas(src, { scaleX: 0.3, scaleY: 0.3 });
                          setActiveDropdown(null);
                        }}
                        className="h-12 rounded-lg border border-gray-200 overflow-hidden hover:border-blue-500 hover:ring-2 ring-blue-100 transition-all bg-white p-1 relative group"
                      >
                        <img
                          src={src}
                          className="w-full h-full object-contain"
                          alt="signature"
                        />
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFromRecent(
                              src,
                              recentSignatures,
                              setRecentSignatures,
                              "recentSignatures",
                            );
                          }}
                          className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-100"
                        >
                          <X size={10} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <input
            type="file"
            ref={signatureInputRef}
            onChange={handleSignatureUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* WHITEOUT */}
        <button
          onClick={() => handleAddShape("whiteout")}
          className="px-2 py-1.5 text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-1.5"
        >
          <Eraser size={18} />
          <span className="text-sm font-medium whitespace-nowrap">
            Whiteout
          </span>
        </button>

        {/* ANNOTATE */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => toggleDropdown("annotate")}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDropdown === "annotate" || activeTool === "highlight"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Highlighter size={18} />
            <span className="text-sm font-medium whitespace-nowrap">
              Annotate
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "annotate" && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => {
                  setActiveTool("highlight");
                  activateHighlightMode();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Highlighter size={16} /> Highlight Text
              </button>
              <button
                onClick={() => {
                  handleAddShape("note");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded-sm" />
                Sticky Note
              </button>
            </div>
          )}
        </div>

        {/* DRAWING CONTROLS */}
        {activeTool === "draw" && (
          <div className="flex items-center gap-2 ml-2 px-2 py-1 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-left-2">
            <div className="text-xs font-semibold text-gray-400 uppercase mr-1">
              Pen
            </div>
            <div className="flex gap-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor?.(c)}
                  className={`w-5 h-5 rounded-full border border-gray-200 ${
                    penColor === c ? "ring-2 ring-blue-500 ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <input
                type="range"
                min="1"
                max="10"
                value={penSize}
                onChange={(e) => setPenSize?.(parseInt(e.target.value))}
                className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="w-3 h-3 rounded-full bg-gray-400" />
            </div>
          </div>
        )}

        {/* SHAPES */}
        <div className="relative toolbar-dropdown">
          <button
            onClick={() => toggleDropdown("shapes")}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeDropdown === "shapes"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Shapes size={18} />
            <span className="text-sm font-medium whitespace-nowrap">
              Shapes
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {activeDropdown === "shapes" && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => {
                  handleAddShape("rect");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Square size={16} /> Rectangle
              </button>
              <button
                onClick={() => {
                  handleAddShape("circle");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Circle size={16} /> Ellipse
              </button>
              <button
                onClick={() => {
                  handleAddShape("line");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <Minus size={16} /> Line
              </button>
              <button
                onClick={() => {
                  handleAddShape("arrow");
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700"
              >
                <ArrowRight size={16} /> Arrow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Tools Group (Undo/Redo) */}
      <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
        {activeTool === "draw" && (
          <button
            onClick={onFinishDrawing}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-1.5 hover:bg-blue-700 transition-colors text-sm font-bold shadow-sm mr-2"
          >
            <Check size={16} />
            <span className="whitespace-nowrap">Done Drawing</span>
          </button>
        )}

        <button
          onClick={onUndo}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          title="Undo"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={onRedo}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          title="Redo"
        >
          <Redo size={18} />
        </button>
      </div>
    </div>
  );
};
