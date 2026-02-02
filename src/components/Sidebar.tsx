import { useEffect, useState, useRef } from "react";
import { Document, Page } from "react-pdf";
import {
  LayoutList,
  LayoutGrid,
  MoreVertical,
  Trash2,
  Copy,
  Undo,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

export const Sidebar = ({
  pdfFile,
  pageNumber,
  setPageNumber,
  pages,
  setPages,
  pageCanvasData,
  setPageCanvasData,
}: {
  pdfFile: string;
  pageNumber: number;
  setPageNumber: (n: number) => void;
  pages: { id: string; page: number }[];
  setPages: (p: { id: string; page: number }[]) => void;
  pageCanvasData: Record<string, string>;
  setPageCanvasData: (d: any) => void;
}) => {
  // View mode
  const [viewMode, setViewMode] = useState<"vertical" | "grid">("vertical");

  // Thumbnail scale
  const [thumbScale, setThumbScale] = useState(0.28);

  const activeRef = useRef<HTMLDivElement | null>(null);

  // History for Undo
  const [history, setHistory] = useState<
    {
      pages: { id: string; page: number }[];
      pageCanvasData: Record<string, string>;
    }[]
  >([]);

  // Auto-scroll active item into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pageNumber]);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor));

  // Drag end logic
  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = pages.findIndex((p) => p.id === active.id);
      const newIndex = pages.findIndex((p) => p.id === over.id);

      const newPages = arrayMove(pages, oldIndex, newIndex);
      setPages(newPages);
    }
  };

  const addToHistory = () => {
    setHistory((prev) => [
      ...prev,
      { pages: [...pages], pageCanvasData: { ...pageCanvasData } },
    ]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setPages(lastState.pages);
    setPageCanvasData(lastState.pageCanvasData);
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleDeletePage = (id: string) => {
    addToHistory();

    if (pages.length <= 1) {
      alert("Cannot delete the last page.");
      return;
    }

    const index = pages.findIndex((p) => p.id === id);
    const filtered = pages.filter((p) => p.id !== id);
    setPages(filtered);

    // If we're deleting the active page OR the active page index shifted
    if (pageNumber === index + 1) {
      // Deleting active page -> go to previous or first
      const nextActiveIndex = Math.max(1, index);
      setPageNumber(nextActiveIndex);
    } else if (index + 1 < pageNumber) {
      // Deleted page was before active page -> shift active page number down
      setPageNumber(pageNumber - 1);
    }
  };

  const handleDuplicatePage = (id: string) => {
    addToHistory();

    const index = pages.findIndex((p) => p.id === id);
    const item = pages[index];
    if (!item) return;

    const newId = crypto.randomUUID();
    const newItem = { id: newId, page: item.page };
    const newPages = [...pages];
    newPages.splice(index + 1, 0, newItem);

    // Copy annotation data
    if (pageCanvasData[item.id]) {
      setPageCanvasData((prev: any) => ({
        ...prev,
        [newId]: pageCanvasData[item.id],
      }));
    }

    setPages(newPages);
  };

  return (
    <div className="w-full h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* TOP TOOLBAR */}
      <div className="p-3 bg-white border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          {/* View mode buttons */}
          <div className="flex items-center gap-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("vertical")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "vertical"
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutList size={16} />
            </button>

            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`p-2 rounded-lg border transition-colors ${
              history.length > 0
                ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
            title="Undo Delete/Duplicate"
          >
            <Undo size={18} />
          </button>
        </div>

        {/* Thumbnail size slider */}
        <input
          type="range"
          min={0.22}
          max={0.5}
          step={0.02}
          value={thumbScale}
          onChange={(e) => setThumbScale(Number(e.target.value))}
          className="w-20"
        />
      </div>

      {/* PAGE LIST */}
      <div className="flex-1 overflow-y-auto p-4">
        <Document file={pdfFile}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={
                  viewMode === "vertical"
                    ? "space-y-4"
                    : "grid grid-cols-2 gap-4 pr-2"
                }
              >
                {pages.map((item, index) => (
                  <SortablePage
                    key={item.id}
                    item={item}
                    index={index}
                    isActive={pageNumber === index + 1}
                    thumbScale={thumbScale}
                    setPageNumber={setPageNumber}
                    activeRef={pageNumber === index + 1 ? activeRef : null}
                    onDelete={() => handleDeletePage(item.id)}
                    onDuplicate={() => handleDuplicatePage(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Document>
      </div>
    </div>
  );
};

/* ------------------------ SORTABLE WRAPPER ------------------------ */

function SortablePage({ item, onDelete, onDuplicate, ...rest }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <ThumbnailPage
        item={item}
        dragHandleProps={{ attributes, listeners }}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        {...rest}
      />
    </div>
  );
}

/* ------------------------ THUMBNAIL COMPONENT ------------------------ */

function ThumbnailPage({
  item,
  index,
  isActive,
  setPageNumber,
  thumbScale,
  activeRef,
  dragHandleProps,
  onDelete,
  onDuplicate,
}: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div
      ref={isActive ? activeRef : null}
      onClick={() => setPageNumber(index + 1)}
      className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all shadow-sm ${
        isActive
          ? "border-blue-500 shadow-lg scale-[1.02]"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* DRAG HANDLE */}
      <div
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
        className="absolute top-2 left-2 bg-white p-1.5 rounded-md shadow-md border border-gray-200 cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-gray-600"
        >
          <circle cx="4" cy="4" r="1.5" fill="currentColor" />
          <circle cx="12" cy="4" r="1.5" fill="currentColor" />
          <circle cx="4" cy="8" r="1.5" fill="currentColor" />
          <circle cx="12" cy="8" r="1.5" fill="currentColor" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </div>

      {/* ACTION MENU BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className={`absolute top-2 right-2 bg-white p-1.5 rounded-md shadow-md border border-gray-200 z-10 transition-opacity ${
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <MoreVertical size={16} />
      </button>

      {/* ACTION MENU */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute top-11 right-2 bg-white border border-gray-200  shadow-lg rounded-md overflow-hidden z-20 min-w-[140px]"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-x-2 px-3 py-2 hover:bg-gray-100 text-sm text-left"
          >
            <Copy size={14} /> Duplicate
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-x-2 px-3 py-2 hover:bg-red-50 text-sm text-red-600 text-left border-t border-gray-100"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* THUMBNAIL */}
      <div className="bg-white p-3 flex items-center justify-center">
        <div className="w-full">
          <Page
            pageNumber={item.page}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            scale={thumbScale}
            className="thumbnail-pdf"
          />
        </div>
      </div>

      {/* PAGE NUMBER LABEL */}
      <div className="bg-white px-2 py-1 text-center text-sm text-gray-600 border-t border-gray-200">
        {index + 1}
      </div>
    </div>
  );
}
