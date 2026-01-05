import {
  Edit,
  Pen,
  Highlighter,
  Type,
  Undo,
  Redo,
  Square,
  Circle,
  EyeOff,
  StickyNote,
  Image as ImageIcon,
} from "lucide-react";
import { CustomDropdown } from "./CustomDropdwn";
import type { Textbox } from "fabric";
import { useRef } from "react";

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
  handleShowDrawingBox,
  updateActiveText,
  toggleTextStyle,
  activateHighlightMode,
  handleAddShape,
  handleAddImage,
}: {
  activeTool: string;
  setActiveTool: (str: string) => void;
  selectedColor: string;
  setSelectedColor: (str: string) => void;
  fontSize: string;
  setFontSize: (str: string) => void;
  fontFamily?: string;
  setFontFamily?: (str: string) => void;
  handleAddText?: () => void;
  handleShowDrawingBox?: () => void;
  updateActiveText: (updates: Partial<Textbox>) => void;
  toggleTextStyle: (str: string) => void;
  activateHighlightMode: () => void;
  handleAddShape: (type: string) => void;
  handleAddImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const tools = [
    { id: "draw", icon: Pen, label: "Draw", action: handleShowDrawingBox },
    {
      id: "highlight",
      icon: Highlighter,
      label: "Highlight",
      action: activateHighlightMode,
    },
    {
      id: "note",
      icon: StickyNote,
      label: "Note",
      action: () => handleAddShape("note"),
    },
    {
      id: "image",
      icon: ImageIcon,
      label: "Image",
      action: () => imageInputRef.current?.click(),
    },
    {
      id: "redact",
      icon: EyeOff,
      label: "Redact",
      action: () => handleAddShape("redact"),
    },
    { id: "text", icon: Type, label: "Add text", action: handleAddText },
    { id: "edit", icon: Edit, label: "Edit text", action: () => {} },
    {
      id: "rect",
      icon: Square,
      label: "Square",
      action: () => handleAddShape("rect"),
    },
    {
      id: "circle",
      icon: Circle,
      label: "Circle",
      action: () => handleAddShape("circle"),
    },
  ];

  const colors = ["#000000", "#EF4444", "#3B82F6"];
  const fontOptions = [
    "Helvetica",
    "Arial",
    "Times New Roman",
    "Courier New",
    "Georgia",
  ];
  const sizeOptions = ["8", "10", "12", "14", "16", "18", "20", "24"];

  return (
    <div className="w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
      {/* Hidden Image Input */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleAddImage}
        accept="image/png, image/jpeg, image/jpg"
        className="hidden"
      />

      <div className="flex items-center gap-1 shrink-0">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                tool.action?.();
              }}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                activeTool === tool.id
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {activeTool === "text" && (
        <>
          <div className="h-6 w-px bg-gray-300 shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-600">Colour</span>
            <div className="flex gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    updateActiveText({ fill: color });
                    setSelectedColor(color);
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? "border-gray-400 scale-110"
                      : "border-gray-200"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <CustomDropdown
            label="Font"
            value={fontFamily?.split(" ").slice(0, 2).join(" ") as string}
            options={fontOptions}
            onChange={setFontFamily as () => void}
            updateActiveText={updateActiveText}
          />

          <CustomDropdown
            label="Size"
            value={fontSize}
            options={sizeOptions}
            onChange={setFontSize}
            updateActiveText={updateActiveText}
          />

          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => toggleTextStyle("fontWeight")}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
            >
              <span className="font-bold">B</span>
            </button>
            <button
              onClick={() => toggleTextStyle("fontStyle")}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
            >
              <span className="italic">I</span>
            </button>
            <button
              onClick={() => toggleTextStyle("underline")}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
            >
              <span className="underline">U</span>
            </button>
          </div>

          <div className="flex gap-1 ml-auto shrink-0">
            <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded">
              <Undo size={18} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded">
              <Redo size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
