import {
  Canvas,
  Circle,
  FabricImage,
  PencilBrush,
  Rect,
  Textbox,
  Group,
  Line,
  Path,
} from "fabric";
import { HistoryManager } from "../utils/HistoryManager";
import { PDFDocument, PDFName } from "pdf-lib";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import toast from "../utils/toast";
import { FileText, Upload, Search, Plus, Minus, Check } from "lucide-react";

import { pdfjs } from "react-pdf";

import { Header } from "./Header";
import { Toolbar } from "./Toolbar";
import { PDFBody } from "./PdfBody";
import { Sidebar } from "./Sidebar";
import { SearchSidebar } from "./SearchSidebar";
import { extractPdfText } from "../utils";
import type { PdfTextItem } from "../types";
import {
  getOriginalPdfBytes,
  loadPageState,
  serializeCanvasForPage,
} from "../utils/functions";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Main PDF Editor component
export interface PdfEditorProps {
  fileUrl?: string | null;
  fileName?: string;
  onSave?: (pdfBytes: Uint8Array, fileName: string) => void;
  onBack?: () => void;
  loading?: boolean;
}

function PdfEditor({
  fileUrl: initialFileUrl,
  fileName: initialFileName,

  onSave,
  onBack,
}: PdfEditorProps) {
  // const [numberPages, setNumberPages] = useState(0);
  const [pages, setPages] = useState<{ id: string; page: number }[]>([]);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [activeSidebar, setActiveSidebar] = useState<"thumbnails" | "search">(
    "thumbnails",
  );
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomScale, setZoomScale] = useState(100);
  const [fileName, setFileName] = useState(initialFileName || "Document.pdf");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Initialize originalPdfSource with prop if available
  const [originalPdfSource, setOriginalPdfSource] = useState<
    string | ArrayBuffer | null
  >(initialFileUrl || null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [penColor, setPenColor] = useState("#000000");
  const [penSize, setPenSize] = useState(3);
  const pdfOverlayContainerRef = useRef<HTMLDivElement | null>(null); // for Fabric overlay
  const pdfOverlayFabricRef = useRef<Canvas | null>(null); // for Fabric instance
  const [canvasInstance, setCanvasInstance] = useState<Canvas | null>(null);
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  // const canvaContainerRef = useRef<HTMLDivElement | null>(null); // Removed
  // const dragHandleRef = useRef<HTMLDivElement>(null); // Removed
  const [pageCanvasData, setPageCanvasData] = useState<Record<string, string>>(
    {},
  );
  const [extractedText, setExtractedText] = useState<PdfTextItem[]>([]);
  const [lastDrawingBounds, setLastDrawingBounds] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl || null);
  const pdfPageRef = useRef<HTMLDivElement | null>(null);
  const [pdfSize, setPdfSize] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState("text");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  interface HistoryState {
    pageId: string;
    pageNumber: number;
    json: string;
  }

  const undoStack = useRef<HistoryState[]>([]);
  const redoStack = useRef<HistoryState[]>([]);
  const lockHistory = useRef<boolean>(false);

  // Version auto-save configuration
  const lastAutoSaveRef = useRef<number>(Date.now());
  const hasInitialVersionRef = useRef<boolean>(false);

  // Highlight state refs
  const isHighlightingRef = useRef(false);
  const highlightRectRef = useRef<Rect | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const drawnPathsRef = useRef<any[]>([]);
  const isPlacingDrawingRef = useRef(false);

  // Link tool refs
  const isDrawingLinkRef = useRef(false);
  const linkStartRef = useRef<{ x: number; y: number } | null>(null);
  const linkRectRef = useRef<Rect | null>(null);

  // Persistence management locks and timers
  const isNavigatingRef = useRef(false);
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<any>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: any | null;
  }>({ x: 0, y: 0, text: null });
  const lastLoadedPage = useRef<string | number | null>(0);

  const pageCanvasDataRef = useRef<Record<string, string>>({});

  useEffect(() => {
    pageCanvasDataRef.current = pageCanvasData;
  }, [pageCanvasData]);

  const saveCurrentPageState = useCallback(
    (index = pageNumber, force = false) => {
      const canvas = canvasInstance || pdfOverlayFabricRef.current;
      const pageId = pages[index - 1]?.id;

      if (!canvas || !pageId || (isNavigatingRef.current && !force)) {
        return null;
      }

      const json = serializeCanvasForPage(canvas);
      if (!json) return null;

      isSavingRef.current = true;

      pageCanvasDataRef.current = {
        ...pageCanvasDataRef.current,
        [pageId]: json,
      };

      setPageCanvasData((prev) => ({
        ...prev,
        [pageId]: json,
      }));

      setTimeout(() => {
        isSavingRef.current = false;
      }, 50);

      return json;
    },
    [pageNumber, pages, canvasInstance],
  );

  const goToPage = async (targetPage: number) => {
    if (targetPage === pageNumber) return;
    if (targetPage < 1 || targetPage > pages.length) return;

    isNavigatingRef.current = true;

    try {
      saveCurrentPageState(pageNumber, true);
      await new Promise((r) => setTimeout(r, 80));
      lastLoadedPage.current = null;
      setPageNumber(targetPage);
    } catch (error) {
      console.warn(" [Navigation] Error during page switch", error);
    } finally {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 300);
    }
  };

  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    const currentPageItem = pages[pageNumber - 1];
    if (!canvas || !currentPageItem) return;

    const pageId = currentPageItem.id;

    const load = async () => {
      if (isNavigatingRef.current) {
        setTimeout(load, 100);
        return;
      }

      try {
        await loadPageState(
          pageId,
          pdfOverlayFabricRef,
          pageCanvasDataRef.current,
        );
        lastLoadedPage.current = pageId;
      } catch (error) {
        console.warn(` [Load] Failed for page ID ${pageId}`, error);
        lastLoadedPage.current = pageId;
      }
    };

    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [pageNumber, pages, canvasInstance, pdfSize, zoomScale]);

  const handleFile = async (file: File) => {
    if (file && file.type === "application/pdf") {
      setFileName(file.name);
      setIsLoading(true);

      const url = URL.createObjectURL(file);
      setFileUrl(url);

      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          setOriginalPdfSource(event.target.result as ArrayBuffer);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file) {
      toast.error("Please upload a valid PDF file");
    }
  };

  const handleLoadFromUrl = async (url: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch PDF");
      const arrayBuffer = await response.arrayBuffer();

      try {
        const urlObj = new URL(url);
        const name = urlObj.pathname.split("/").pop();
        if (name && name.endsWith(".pdf")) {
          setFileName(name);
        } else {
          setFileName("Remote Document.pdf");
        }
      } catch {
        setFileName("Remote Document.pdf");
      }

      setOriginalPdfSource(arrayBuffer);
      setFileUrl(url);
      toast.success("PDF loaded successfully");
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF from URL");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    const handleModification = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (!isNavigatingRef.current && !isSavingRef.current) {
          saveCurrentPageState();
        }
      }, 400);
    };

    canvas.on("object:modified", handleModification);
    canvas.on("object:added", handleModification);
    canvas.on("object:removed", handleModification);

    return () => {
      canvas.off("object:modified", handleModification);
      canvas.off("object:added", handleModification);
      canvas.off("object:removed", handleModification);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [pageNumber, pages, canvasInstance]);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleDocumentLoad = (pdf: any) => {
    setPdfDocument(pdf);

    const initialPages = Array.from({ length: pdf.numPages }, (_, i) => ({
      id: crypto.randomUUID(),
      page: i + 1,
    }));
    setPages(initialPages);

    setTimeout(() => {
      const pdfId = fileUrl || "default-pdf";
      if (pdfId && !hasInitialVersionRef.current) {
        HistoryManager.saveVersion(pdfId, pageCanvasData, "Initial import");
        hasInitialVersionRef.current = true;
        lastAutoSaveRef.current = Date.now();
      }
    }, 500);
  };

  const handlePageOnloadSuccess = async (page: any) => {
    if (!page) return;
    if (!pdfPageRef.current) return;
    const { width, height } = pdfPageRef.current.getBoundingClientRect();
    const textItems = await extractPdfText(page);
    setExtractedText(textItems);

    if (width > 0 && height > 0) {
      setPdfSize({ width, height });
    }
    setIsLoading(false);
  };

  const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 10, 50));

  const showContextMenu = (textItem: any, x: number, y: number) => {
    if (!pdfPageRef.current) return;
    const rect = pdfPageRef.current.getBoundingClientRect();
    const relativeX = x - rect.left;
    const relativeY = y - rect.top;
    setContextMenu({ x: relativeX, y: relativeY, text: textItem });
  };

  const hideContextMenu = () => {
    setContextMenu({ x: 0, y: 0, text: null });
  };

  useEffect(() => {
    const handleWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoomScale((previous) => Math.min(previous + 10, 200));
        } else {
          setZoomScale((previous) => Math.max(previous - 10, 50));
        }
      }
    };
    const container = viewerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheelZoom, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener("wheel", handleWheelZoom);
    };
  }, []);

  useEffect(() => {
    let initialDistance: number | null = null;
    let initialScale: number = zoomScale;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDistance = Math.hypot(dx, dy);
        initialScale = zoomScale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.hypot(dx, dy);
        const zoomFactor = currentDistance / initialDistance;
        const newScale = Math.min(Math.max(initialScale * zoomFactor, 50), 200);
        setZoomScale(newScale);
      }
    };

    const container = viewerRef.current;
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      container.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
    }
    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
      }
    };
  }, [zoomScale]);

  useEffect(() => {
    const container = pdfOverlayContainerRef.current;
    if (!container || !pdfSize.width) return;

    container.innerHTML = "";

    const el = document.createElement("canvas");
    el.width = pdfSize.width;
    el.height = pdfSize.height;
    container.append(el);

    const fabricCanvas = new Canvas(el, {
      selection: true,
      preserveObjectStacking: true,
    });

    pdfOverlayFabricRef.current = fabricCanvas;
    setCanvasInstance(fabricCanvas);

    fabricCanvas.on("mouse:down", (opt) => {
      const evt = opt.e as MouseEvent;
      const target = opt.target as any;

      if (!target) return hideContextMenu();

      // Only show text context menu if "edit" tool is active and target is text
      if (activeToolRef.current === "edit" && target.pdfMeta?.type === "text") {
        showContextMenu(target.pdfMeta, evt.clientX, evt.clientY);
      } else {
        hideContextMenu();
      }
    });

    return () => {
      fabricCanvas.dispose();
      pdfOverlayFabricRef.current = null;
      setCanvasInstance(null);
    };
  }, [pdfSize]);

  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    const oldText = canvas
      .getObjects()
      .filter((o: any) => o.isHitbox || o.pdfMeta?.type === "text");
    oldText.forEach((o) => canvas.remove(o));

    extractedText.forEach((item) => {
      const box = new Rect({
        left: item.x,
        top: item.y - item.height,
        width: item.width,
        height: item.height,
        fill: "rgba(0,0,0,0)",
        selectable: false,
        evented: true,
        hoverCursor: "text",
        pdfMeta: { type: "text", ...item },
      });
      (box as any).isHitbox = true;
      canvas.add(box);
    });

    canvas.renderAll();
  }, [extractedText, canvasInstance]);

  const handleDeleteCanva = () => {
    const activeObject = pdfOverlayFabricRef.current?.getActiveObject();
    if (activeObject) {
      pdfOverlayFabricRef.current?.remove(activeObject);
      pdfOverlayFabricRef.current?.discardActiveObject();
      pdfOverlayFabricRef.current?.renderAll();
    }
  };

  const [fontSize, setFontSize] = useState("12");
  const [fontFamily, setFontFamily] = useState("Arial");

  const getCanvasVisibleOrigin = () => {
    if (!viewerRef.current || !pdfPageRef.current) return { x: 0, y: 0 };
    // 1. Get the screen coordinates of the scroll container and the actual PDF page
    const containerRect = viewerRef.current.getBoundingClientRect();
    const pageRect = pdfPageRef.current.getBoundingClientRect();
    const zoomFactor = zoomScale / 100;
    // 2. Calculate the difference (how much the page is scrolled up/left)
    // If pageRect.top is -500 (scrolled up), and containerRect.top is 0, offset is 500.
    const visualOffsetX = Math.max(0, containerRect.left - pageRect.left);
    const visualOffsetY = Math.max(0, containerRect.top - pageRect.top);
    // 3. Convert screen pixels back to unscaled canvas coordinates
    return {
      x: visualOffsetX / zoomFactor,
      y: visualOffsetY / zoomFactor,
    };
  };

  const handleAddText = () => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasVisibleOrigin();
    const textBox = new Textbox("Enter text here", {
      left: x + 100,
      top: y + 100,
      fontSize: Number(fontSize),
      fontFamily: fontFamily,
      editable: true,
    });
    canvas.add(textBox);
    canvas.setActiveObject(textBox);
    canvas.renderAll();
    setTimeout(saveCurrentPageState, 100);
  };

  const updateActiveText = (styleProps: object) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject?.type === "textbox") {
      activeObject.set({ ...styleProps });
      canvas.renderAll();
    }
  };

  const ToggleTextStyle = (style: string) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject?.type === "textbox") {
      const currentValue = activeObject.get(style as any);
      let newValue: any;
      if (style === "fontWeight")
        newValue = currentValue === "bold" ? "normal" : "bold";
      else if (style === "fontStyle")
        newValue = currentValue === "italic" ? "normal" : "italic";
      else if (style === "underline") newValue = !currentValue;
      else return;
      activeObject.set(style as any, newValue);
      canvas.renderAll();
    }
  };

  // Capture state on mouse down (before modification)
  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    let startState: string | null = null;

    const onMouseDown = () => {
      startState = serializeCanvasForPage(canvas);
    };

    const onModification = () => {
      if (lockHistory.current) return;
      if (startState) {
        const pageId = pages[pageNumber - 1]?.id;
        if (pageId) {
          undoStack.current.push({
            pageId,
            pageNumber,
            json: startState,
          });
          redoStack.current = [];
        }
      }
      startState = serializeCanvasForPage(canvas);
    };

    const onSelectionCreated = (e: any) => {
      const obj = e.selected?.[0];
      if (!obj) return;
      if (obj.type === "textbox" || obj.type === "i-text") {
        if (obj.fill) setSelectedColor(obj.fill as string);
        if (obj.fontFamily) setFontFamily(obj.fontFamily);
        if (obj.fontSize) setFontSize(String(obj.fontSize));
      }
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("object:modified", onModification);
    canvas.on("object:added", onModification);
    canvas.on("object:removed", onModification);
    canvas.on("selection:created", onSelectionCreated);
    canvas.on("selection:updated", onSelectionCreated);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("object:modified", onModification);
      canvas.off("object:added", onModification);
      canvas.off("object:removed", onModification);
      canvas.off("selection:created", onSelectionCreated);
      canvas.off("selection:updated", onSelectionCreated);
    };
  }, [pageNumber, pages, canvasInstance]);

  const undo = async () => {
    if (undoStack.current.length === 0) return;
    lockHistory.current = true;

    const prevState = undoStack.current.pop()!;

    const currentPageId = pages[pageNumber - 1]?.id;

    // Save current state to Redo
    const canvas = pdfOverlayFabricRef.current;
    const currentJson = canvas ? serializeCanvasForPage(canvas) : null;

    if (currentPageId && currentJson) {
      redoStack.current.push({
        pageId: currentPageId,
        pageNumber: pageNumber,
        json: currentJson,
      });
    }

    try {
      if (prevState.pageNumber !== pageNumber) {
        // Switch page
        setPageCanvasData((prev) => ({
          ...prev,
          [prevState.pageId]: prevState.json,
        }));
        goToPage(prevState.pageNumber);
      } else {
        // Same page
        if (canvas) {
          await loadPageState(prevState.pageId, pdfOverlayFabricRef, {
            [prevState.pageId]: prevState.json,
          });
          setPageCanvasData((prev) => ({
            ...prev,
            [prevState.pageId]: prevState.json,
          }));
        }
      }
    } finally {
      lockHistory.current = false;
    }
  };

  const redo = async () => {
    if (redoStack.current.length === 0) return;
    lockHistory.current = true;

    const nextState = redoStack.current.pop()!;

    const currentPageId = pages[pageNumber - 1]?.id;

    const canvas = pdfOverlayFabricRef.current;
    const currentJson = canvas ? serializeCanvasForPage(canvas) : null;
    if (currentPageId && currentJson) {
      undoStack.current.push({
        pageId: currentPageId,
        pageNumber: pageNumber,
        json: currentJson,
      });
    }

    try {
      if (nextState.pageNumber !== pageNumber) {
        setPageCanvasData((prev) => ({
          ...prev,
          [nextState.pageId]: nextState.json,
        }));
        goToPage(nextState.pageNumber);
      } else {
        if (canvas) {
          await loadPageState(nextState.pageId, pdfOverlayFabricRef, {
            [nextState.pageId]: nextState.json,
          });
          setPageCanvasData((prev) => ({
            ...prev,
            [nextState.pageId]: nextState.json,
          }));
        }
      }
    } finally {
      lockHistory.current = false;
    }
  };

  const duplicateSelectedObject = () => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;
    if ((activeObject as any).pdfMeta?.type === "text-replacement") return;

    // Capture state before duplication for Undo
    const pageId = pages[pageNumber - 1]?.id;
    const currentJson = serializeCanvasForPage(canvas);
    if (pageId && currentJson) {
      undoStack.current.push({
        pageId,
        pageNumber,
        json: currentJson,
      });
      redoStack.current = [];
    }

    activeObject.clone().then((cloned: any) => {
      canvas.discardActiveObject();
      cloned.set({
        left: cloned.left + 20,
        top: cloned.top + 20,
        evented: true,
      });
      if (cloned.type === "activeSelection") {
        cloned.canvas = canvas;
        cloned.forEachObject((obj: any) => {
          canvas.add(obj);
        });
        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      saveCurrentPageState();
    });
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Undo / Redo
      if (e.ctrlKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        await undo();
      } else if (
        (e.ctrlKey && e.key.toLowerCase() === "y") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        await redo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelectedObject();
      }
      // Delete
      if (e.key === "Delete" || e.key === "Escape") handleDeleteCanva();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageNumber, pages]); // Re-bind on page change to ensure state freshness if needed

  const enableTextEditMode = () => {
    if (pdfOverlayFabricRef.current) {
      pdfOverlayFabricRef.current.isDrawingMode = false;
      pdfOverlayFabricRef.current.defaultCursor = "text";
    }
  };

  const updateHighlight = useCallback((opt: any) => {
    if (
      !isHighlightingRef.current ||
      !highlightRectRef.current ||
      !pdfOverlayFabricRef.current
    )
      return;
    const pointer = pdfOverlayFabricRef.current.getPointer(opt.e);
    highlightRectRef.current.set({
      width: Math.abs(pointer.x - startXRef.current),
      height: Math.abs(pointer.y - startYRef.current),
      left: Math.min(pointer.x, startXRef.current),
      top: Math.min(pointer.y, startYRef.current),
    });
    pdfOverlayFabricRef.current.renderAll();
  }, []);

  const finishHighlight = useCallback(() => {
    if (pdfOverlayFabricRef.current) {
      isHighlightingRef.current = false;
      highlightRectRef.current = null;
      pdfOverlayFabricRef.current.off("mouse:move", updateHighlight);
      pdfOverlayFabricRef.current.off("mouse:up", finishHighlight);
      setTimeout(saveCurrentPageState, 100);
    }
  }, [updateHighlight]);

  const startHighlighting = useCallback(
    (opt: any) => {
      if (activeToolRef.current !== "highlight") return;
      const canvas = pdfOverlayFabricRef.current;
      if (!canvas) return;
      const pointer = canvas.getPointer(opt.e);
      const target = opt.target as any;

      if (target?.pdfMeta?.type === "text") {
        const meta = target.pdfMeta;
        const rect = new Rect({
          left: meta.x,
          top: meta.y - meta.height,
          width: meta.width,
          height: meta.height,
          fill: "yellow",
          opacity: 0.4,
          selectable: true,
          pdfMeta: { type: "highlight", source: "text" },
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        canvas.renderAll();
        setTimeout(saveCurrentPageState, 100);
        return;
      }

      isHighlightingRef.current = true;
      startXRef.current = pointer.x;
      startYRef.current = pointer.y;
      const newRect = new Rect({
        left: startXRef.current,
        top: startYRef.current,
        width: 0,
        height: 0,
        fill: "yellow",
        opacity: 0.4,
        pdfMeta: { type: "highlight", source: "manual" },
      });
      highlightRectRef.current = newRect;
      canvas.add(newRect);
      canvas.on("mouse:move", updateHighlight);
      canvas.on("mouse:up", finishHighlight);
    },
    [updateHighlight, finishHighlight],
  );

  const activateHighlightMode = () => {
    setActiveTool("highlight");
    const canvas = pdfOverlayFabricRef.current;
    if (canvas) {
      canvas.isDrawingMode = false;
    }
  };

  const activateLinkMode = () => {
    setActiveTool("link");
    const canvas = pdfOverlayFabricRef.current;
    if (canvas) {
      canvas.isDrawingMode = false;
    }
  };

  const activateDrawMode = () => {
    setActiveTool("draw");
    const canvas = pdfOverlayFabricRef.current;
    if (canvas) {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        const pencil = new PencilBrush(canvas);
        canvas.freeDrawingBrush = pencil;
      }
      canvas.freeDrawingBrush.width = penSize;
      canvas.freeDrawingBrush.color = penColor;
    }
  };

  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    if (activeTool === "draw") {
      canvas.isDrawingMode = true;
      drawnPathsRef.current = []; // Reset tracked paths

      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.width = penSize;
      canvas.freeDrawingBrush.color = penColor;

      const handlePathCreated = (e: any) => {
        drawnPathsRef.current.push(e.path);

        // Calculate bounds of ALL drawn paths to position the button correctly
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        drawnPathsRef.current.forEach((p: any) => {
          const { left, top, width, height } = p.getBoundingRect();
          if (left < minX) minX = left;
          if (top < minY) minY = top;
          if (left + width > maxX) maxX = left + width;
          if (top + height > maxY) maxY = top + height;
        });

        if (minX !== Infinity) {
          setLastDrawingBounds({
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
          });
        }

        setTimeout(saveCurrentPageState, 100);
      };

      canvas.on("path:created", handlePathCreated);
      return () => {
        canvas.isDrawingMode = false;
        canvas.off("path:created", handlePathCreated);
      };
    } else {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, penSize, penColor, saveCurrentPageState]);

  // Highlight mode effect
  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    if (activeTool === "highlight") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "crosshair";
      canvas.on("mouse:down", startHighlighting);
    } else if (activeTool === "link") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "crosshair";
      canvas.on("mouse:down", startLinkDrawing);
    }

    return () => {
      canvas.off("mouse:down", startHighlighting);
      canvas.off("mouse:down", startLinkDrawing);
      if (isHighlightingRef.current) {
        canvas.off("mouse:move", updateHighlight);
        canvas.off("mouse:up", finishHighlight);
        if (highlightRectRef.current) {
          canvas.remove(highlightRectRef.current);
          canvas.renderAll();
        }
        isHighlightingRef.current = false;
        highlightRectRef.current = null;
      }
      if (isDrawingLinkRef.current) {
        canvas.off("mouse:move", updateLinkDrawing);
        canvas.off("mouse:up", finishLinkDrawing);
        if (linkRectRef.current) {
          canvas.remove(linkRectRef.current);
          canvas.renderAll();
        }
        isDrawingLinkRef.current = false;
        linkRectRef.current = null;
      }
    };
  }, [activeTool, startHighlighting, updateHighlight, finishHighlight]);

  // Link drawing handlers
  const startLinkDrawing = (o: any) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    isDrawingLinkRef.current = true;
    const pointer = canvas.getPointer(o.e);
    linkStartRef.current = { x: pointer.x, y: pointer.y };

    const rect = new Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 0,
      fill: "rgba(59, 130, 246, 0.2)",
      stroke: "#3b82f6",
      strokeWidth: 2,
      selectable: false,
    });

    linkRectRef.current = rect;
    canvas.add(rect);

    canvas.on("mouse:move", updateLinkDrawing);
    canvas.on("mouse:up", finishLinkDrawing);
  };

  const updateLinkDrawing = (o: any) => {
    if (
      !isDrawingLinkRef.current ||
      !linkStartRef.current ||
      !linkRectRef.current
    )
      return;
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(o.e);
    const startX = linkStartRef.current.x;
    const startY = linkStartRef.current.y;

    if (startX > pointer.x) {
      linkRectRef.current.set({ left: Math.abs(pointer.x) });
    }
    if (startY > pointer.y) {
      linkRectRef.current.set({ top: Math.abs(pointer.y) });
    }

    linkRectRef.current.set({
      width: Math.abs(startX - pointer.x),
      height: Math.abs(startY - pointer.y),
    });

    canvas.renderAll();
  };

  const finishLinkDrawing = () => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas || !linkRectRef.current) return;

    isDrawingLinkRef.current = false;
    canvas.off("mouse:move", updateLinkDrawing);
    canvas.off("mouse:up", finishLinkDrawing);

    const url = prompt("Enter URL for this link:", "https://");
    if (url) {
      linkRectRef.current.set({
        selectable: true,
        pdfMeta: { type: "link", url: url },
      });
      canvas.setActiveObject(linkRectRef.current);
      saveCurrentPageState();
    } else {
      canvas.remove(linkRectRef.current);
    }

    linkRectRef.current = null;
    linkStartRef.current = null;
    canvas.renderAll();
    setActiveTool("select");
  };

  const handleFinishDrawing = () => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    // Turn off drawing mode
    canvas.isDrawingMode = false;
    setActiveTool("select");

    const paths = drawnPathsRef.current.filter((p) => p.canvas === canvas);
    if (paths.length === 0) return;

    // Remove individual paths from canvas
    paths.forEach((p) => canvas.remove(p));

    // Create group
    const group = new Group(paths, {
      originX: "center",
      originY: "center",
      selectable: true,
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();

    // Enable "follow mode"
    isPlacingDrawingRef.current = true;
    toast.success("Click to place your drawing");
  };

  // Effect to handle drawing placement (follow cursor)
  useEffect(() => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;

    const handleMove = (opt: any) => {
      if (isPlacingDrawingRef.current && canvas.getActiveObject()) {
        const ptr = canvas.getPointer(opt.e);
        const obj = canvas.getActiveObject();
        if (obj) {
          obj.set({
            left: ptr.x,
            top: ptr.y,
          });
          obj.setCoords();
          canvas.renderAll();
        }
      }
    };

    const handleDown = () => {
      if (isPlacingDrawingRef.current) {
        isPlacingDrawingRef.current = false;
        saveCurrentPageState();
      }
    };

    canvas.on("mouse:move", handleMove);
    canvas.on("mouse:down", handleDown);

    return () => {
      canvas.off("mouse:move", handleMove);
      canvas.off("mouse:down", handleDown);
    };
  }, [saveCurrentPageState]);

  const handleAddShape = (type: string) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasVisibleOrigin();

    let shape: any;
    if (type === "rect")
      shape = new Rect({
        left: x + 100,
        top: y + 100,
        width: 100,
        height: 100,
        fill: "transparent",
        stroke: selectedColor,
        strokeWidth: 2,
        pdfMeta: { type: "shape", shape: "rect" },
      });
    else if (type === "circle")
      shape = new Circle({
        left: x + 150,
        top: y + 150,
        radius: 50,
        fill: "transparent",
        stroke: selectedColor,
        strokeWidth: 2,
        pdfMeta: { type: "shape", shape: "circle" },
      });
    else if (type === "line")
      shape = new Line([x + 50, y + 100, x + 200, y + 100], {
        stroke: selectedColor,
        strokeWidth: 4,
        pdfMeta: { type: "shape", shape: "line" },
      });
    else if (type === "arrow") {
      shape = new Path("M 0 0 L 200 0 L 190 10 M 200 0 L 190 -10", {
        left: x + 100,
        top: y + 100,
        stroke: selectedColor,
        strokeWidth: 2,
        fill: "transparent",
        pdfMeta: { type: "shape", shape: "arrow" },
      });
    } else if (type === "redact")
      shape = new Rect({
        left: x + 100,
        top: y + 100,
        width: 150,
        height: 50,
        fill: "black",
        pdfMeta: { type: "redact-preview" },
      });
    else if (type === "whiteout")
      shape = new Rect({
        left: x + 100,
        top: y + 100,
        width: 150,
        height: 50,
        fill: "white",
        pdfMeta: { type: "whiteout-preview" },
      });
    else if (type === "stamp") {
      const text = new Textbox("CONFIDENTIAL", {
        fontSize: 24,
        fill: "red",
        fontWeight: "bold",
        fontFamily: "Arial",
        originX: "center",
        originY: "center",
        textAlign: "center",
      });
      const border = new Rect({
        width: text.width + 20,
        height: text.height + 20,
        fill: "transparent",
        stroke: "red",
        strokeWidth: 3,
        originX: "center",
        originY: "center",
      });
      shape = new Group([border, text], {
        left: x + 100,
        top: y + 100,
        angle: -15,
        opacity: 0.8,
        // @ts-ignore - pdfMeta is a custom property added to track stamp metadata
        pdfMeta: { type: "stamp" },
      });
    } else if (type === "note")
      shape = new Textbox("Sticky Note", {
        left: x + 100,
        top: y + 100,
        width: 150,
        fontSize: 14,
        fill: "#000",
        backgroundColor: "#fef08a",
        fontFamily: "Arial",
        borderColor: "#eab308",
        pdfMeta: { type: "sticky-note" },
      });

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
      setTimeout(saveCurrentPageState, 100);
    }
  };

  const handleAddField = (type: string) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasVisibleOrigin();

    let field: any;
    if (type === "text") {
      field = new Textbox("Text Field", {
        left: x + 100,
        top: y + 100,
        width: 150,
        fontSize: 14,
        fill: "#000",
        backgroundColor: "#eef2ff",
        borderColor: "#6366f1",
        borderScaleFactor: 2,
        padding: 5,
        pdfMeta: {
          type: "form-field",
          fieldType: "text",
          name: `field_${Date.now()}`,
        },
      });
    } else if (type === "checkbox") {
      field = new Rect({
        left: x + 100,
        top: y + 100,
        width: 20,
        height: 20,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 2,
        pdfMeta: {
          type: "form-field",
          fieldType: "checkbox",
          name: `check_${Date.now()}`,
        },
      });
    } else if (type === "radio") {
      field = new Circle({
        left: x + 100,
        top: y + 100,
        radius: 10,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 2,
        pdfMeta: {
          type: "form-field",
          fieldType: "radio",
          name: `radio_${Date.now()}`,
        },
      });
    }

    if (field) {
      canvas.add(field);
      canvas.setActiveObject(field);
      canvas.renderAll();
      setTimeout(saveCurrentPageState, 100);
    }
  };

  const pdfId = fileUrl || "default-pdf";

  const generateFinalPdf = async () => {
    if (!originalPdfSource) throw new Error("No PDF loaded");

    // Save current page state first
    saveCurrentPageState(pageNumber);

    const existingPdfBytes = await getOriginalPdfBytes(originalPdfSource);
    const originalPdfDoc = await PDFDocument.load(existingPdfBytes);
    const newPdfDoc = await PDFDocument.create();

    // Determine modified pages and SIGNIFICANT objects
    const modifiedStates: Record<string, any> = {};
    for (const [id, state] of Object.entries(pageCanvasDataRef.current)) {
      const parsed = JSON.parse(state);
      if (parsed.objects && parsed.objects.some((obj: any) => !obj.isHitbox)) {
        modifiedStates[id] = state;
      }
    }

    // Batch copy ALL pages at once (extremely fast even for 1000+ pages)
    const allIndices = pages.map((p) => p.page - 1);
    const copiedPages = await newPdfDoc.copyPages(originalPdfDoc, allIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      const copiedPage = copiedPages[i];
      newPdfDoc.addPage(copiedPage);

      const item = pages[i];
      const savedState = modifiedStates[item.id];

      if (savedState) {
        const tempCanvasEl = document.createElement("canvas");
        const { width: currentPdfWidth, height: currentPdfHeight } =
          copiedPage.getSize();

        // Set canvas to EXACT PDF point dimensions for perfect mapping
        tempCanvasEl.width = currentPdfWidth;
        tempCanvasEl.height = currentPdfHeight;
        const tempFabricCanvas = new Canvas(tempCanvasEl);

        // Calculate scale factor relative to screen dimensions
        const scaleFactor = currentPdfWidth / pdfSize.width;

        await tempFabricCanvas.loadFromJSON(savedState);

        // Scale objects from screen space to PDF point space and remove hitboxes
        const objects = tempFabricCanvas.getObjects();
        const formObjects: any[] = [];
        const linkObjects: any[] = [];

        objects.forEach((obj: any) => {
          if (obj.isHitbox) {
            tempFabricCanvas.remove(obj);
            return;
          }

          // Extract special objects (forms, links)
          if (obj.pdfMeta && obj.pdfMeta.type === "form-field") {
            formObjects.push({
              ...obj.toObject(["pdfMeta"]),
              left: (obj.left || 0) * scaleFactor,
              top: (obj.top || 0) * scaleFactor,
              width: obj.getScaledWidth() * scaleFactor,
              height: obj.getScaledHeight() * scaleFactor,
              pdfMeta: obj.pdfMeta,
            });
            tempFabricCanvas.remove(obj); // Don't burn into image
            return;
          }

          if (obj.pdfMeta && obj.pdfMeta.type === "link") {
            linkObjects.push({
              ...obj.toObject(["pdfMeta"]),
              left: (obj.left || 0) * scaleFactor,
              top: (obj.top || 0) * scaleFactor,
              width: obj.getScaledWidth() * scaleFactor,
              height: obj.getScaledHeight() * scaleFactor,
              pdfMeta: obj.pdfMeta,
            });
            tempFabricCanvas.remove(obj); // Don't burn into image
            return;
          }

          obj.scaleX = (obj.scaleX || 1) * scaleFactor;
          obj.scaleY = (obj.scaleY || 1) * scaleFactor;
          obj.left = (obj.left || 0) * scaleFactor;
          obj.top = (obj.top || 0) * scaleFactor;
          obj.setCoords();
        });

        tempFabricCanvas.renderAll();

        // Use PNG for transparency (required for overlays)
        // Optimized multiplier (1.0) and PNG format to keep size minimal
        const dataUrl = tempFabricCanvas.toDataURL({
          format: "png",
          multiplier: 2,
        });

        const embeddedImage = await newPdfDoc.embedPng(
          await fetch(dataUrl).then((r) => r.arrayBuffer()),
        );

        copiedPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: currentPdfWidth,
          height: currentPdfHeight,
        });

        // --- Process Forms ---
        if (formObjects.length > 0) {
          const form = newPdfDoc.getForm();
          formObjects.forEach((obj) => {
            const { left, top, width, height, pdfMeta } = obj;
            // PDF coordinates: (0,0) is bottom-left. Fabric: (0,0) is top-left.
            // y = pageHeight - top - height
            const pdfY = currentPdfHeight - top - height;

            if (pdfMeta.fieldType === "text") {
              const textField = form.createTextField(pdfMeta.name);
              textField.setText("Enter text");
              textField.addToPage(copiedPage, {
                x: left,
                y: pdfY,
                width,
                height,
              });
            } else if (pdfMeta.fieldType === "checkbox") {
              const checkBox = form.createCheckBox(pdfMeta.name);
              checkBox.addToPage(copiedPage, {
                x: left,
                y: pdfY,
                width,
                height,
              });
            } else if (pdfMeta.fieldType === "radio") {
              // Radio groups are complex, simplistic implementation for now
              // Ideally we group by name, but here unique names are generated
              const radioGroup = form.createRadioGroup(pdfMeta.name);
              radioGroup.addOptionToPage("Yes", copiedPage, {
                x: left,
                y: pdfY,
                width,
                height,
              });
            }
          });
        }

        // --- Process Links ---
        if (linkObjects.length > 0) {
          linkObjects.forEach((obj) => {
            const { left, top, width, height, pdfMeta } = obj;
            const pdfY = currentPdfHeight - top - height;

            // Create Link Annotation
            // pdf-lib doesn't have a high-level `addLink` for external URLs easily accessible on `page`
            // but we can add an annotation.

            // Actually, creating a link annotation via low-level objects
            const linkAnnot = newPdfDoc.context.obj({
              Type: "Annot",
              Subtype: "Link",
              Rect: [left, pdfY, left + width, pdfY + height],
              Border: [0, 0, 2], // Blue border
              C: [0, 0, 1], // Color blue
              A: {
                Type: "Action",
                S: "URI",
                URI: pdfMeta.url,
              },
            });

            const linkRef = newPdfDoc.context.register(linkAnnot);

            let annots = copiedPage.node.Annots();
            if (!annots) {
              annots = newPdfDoc.context.obj([]);
              copiedPage.node.set(PDFName.of("Annots"), annots);
            }
            annots.push(linkRef);
          });
        }

        // Clean up
        tempFabricCanvas.dispose();
      }
    }

    return await newPdfDoc.save();
  };

  const handleDownloadPDF = async () => {
    try {
      setIsLoading(true);
      const pdfBytes = await generateFinalPdf();

      // Default behavior: download file
      const url = URL.createObjectURL(
        new Blob([pdfBytes as any], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
      link.click();
      toast.success("Document downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download document");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSave = async () => {
    if (!onSave) return;
    try {
      setIsLoading(true);
      const pdfBytes = await generateFinalPdf();
      onSave(pdfBytes, fileName);
      toast.success("Document saved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save document");
    } finally {
      setIsLoading(false);
    }
  };

  const restoreVersion = async (versionData: Record<number, string>) => {
    setPageCanvasData(versionData);
    if (pdfOverlayFabricRef.current)
      await loadPageState(pageNumber, pdfOverlayFabricRef, versionData);
  };

  const handleExportPageAsImage = async () => {
    if (!pdfDocument || !pdfOverlayFabricRef.current) return;
    try {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const fabricDataUrl = pdfOverlayFabricRef.current.toDataURL({
        format: "png",
        multiplier: viewport.width / (pdfOverlayFabricRef.current.width || 1),
      });

      const img = new Image();
      img.src = fabricDataUrl;
      await new Promise((r) => (img.onload = r));
      context.drawImage(img, 0, 0, canvas.width, canvas.height);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `page_${pageNumber}.png`;
      link.click();
      toast.success("Page exported as image!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export image");
    }
  };

  const addImageToCanvas = (url: string, options: any = {}) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasVisibleOrigin();

    FabricImage.fromURL(url).then((img) => {
      // Calculate a smaller size (e.g., max 200px width/height)
      const maxSize = 200;
      let scaleX = 0.5;
      let scaleY = 0.5;

      if (img.width && img.height) {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        scaleX = scale;
        scaleY = scale;
      }

      img.set({
        left: x + 100,
        top: y + 100,
        scaleX: scaleX,
        scaleY: scaleY,
        ...options,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      setTimeout(saveCurrentPageState, 100);
    });
  };

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      const data = f.target?.result as string;
      if (data) {
        addImageToCanvas(data);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      className="w-full h-screen flex flex-col bg-white overflow-hidden"
      ref={viewerRef}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-100 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg shadow-blue-200/50"></div>
          <p className="text-slate-600 font-bold text-sm tracking-wide animate-pulse">
            Processing PDF...
          </p>
        </div>
      )}

      {/* Header */}
      <Header
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onSave={onSave ? handleCustomSave : undefined}
        onDownload={handleDownloadPDF}
        onUpload={handleFileUpload}
        onExportImage={handleExportPageAsImage}
        pageNumber={pageNumber}
        totalPages={pages.length}
        onPageChange={goToPage}
        pdfId={pdfId}
        onRestore={restoreVersion}
        fileName={fileName}
        onBack={onBack}
      />
      {/* TOOLBAR */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        updateActiveText={updateActiveText}
        handleAddText={() => {
          handleAddText();
          enableTextEditMode();
        }}
        toggleTextStyle={ToggleTextStyle}
        activateHighlightMode={activateHighlightMode}
        handleAddShape={handleAddShape}
        activateDrawMode={activateDrawMode}
        penColor={penColor}
        setPenColor={setPenColor}
        penSize={penSize}
        setPenSize={setPenSize}
        handleAddImage={handleAddImage}
        addImageToCanvas={addImageToCanvas}
        onUndo={undo}
        onRedo={redo}
        onFinishDrawing={handleFinishDrawing}
        handleAddField={handleAddField}
        activateLinkMode={activateLinkMode}
        onEnterEditMode={enableTextEditMode}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 relative overflow-hidden">
        {/* EMPTY STATE */}
        {!originalPdfSource && (
          // <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-8 z-10">
          //   <div className="max-w-md w-full text-center space-y-6">
          //     <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
          //       <FileText size={40} className="text-blue-600" />
          //     </div>
          //     <div>
          //       <h2 className="text-2xl font-bold text-slate-900">
          //         Ready to Edit?
          //       </h2>
          //       <p className="text-slate-500 mt-2">
          //         Upload a PDF file or enter a live URL to get started.
          //       </p>
          //     </div>

          //     <div className="space-y-4">
          //       <button
          //         onClick={() =>
          //           document
          //             .querySelector<HTMLInputElement>('input[type="file"]')
          //             ?.click()
          //         }
          //         className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          //       >
          //         <Upload size={20} />
          //         Upload PDF File
          //       </button>

          //       <div className="flex items-center gap-2">
          //         <div className="h-px flex-1 bg-slate-200" />
          //         <span className="text-xs text-slate-500 font-bold uppercase">
          //           or
          //         </span>
          //         <div className="h-px flex-1 bg-slate-200" />
          //       </div>

          //       <div className="relative group">
          //         <input
          //           type="text"
          //           placeholder="Paste a live PDF URL here..."
          //           className="w-full px-4 py-3 pl-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all"
          //           onKeyDown={(e) => {
          //             if (e.key === "Enter") {
          //               handleLoadFromUrl(e.currentTarget.value);
          //             }
          //           }}
          //         />
          //         <Search
          //           size={16}
          //           className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
          //         />
          //       </div>
          //     </div>
          //   </div>
          // </div>
          <div
            className={`absolute inset-0 flex items-center justify-center p-6 z-10 transition-colors ${
              isDragging ? "bg-blue-50/50" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              className={`w-full max-w-lg rounded-3xl p-10 text-center transition-all ${
                isDragging
                  ? "bg-white shadow-2xl scale-[1.02] border-2 border-dashed border-blue-400"
                  : ""
              }`}
            >
              {/* Icon */}
              <div className="relative mx-auto mb-6 w-20 h-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <FileText size={38} className="text-white" />
                <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 blur-xl" />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-semibold text-slate-900">
                Start Editing Your PDF
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Upload a PDF or paste a live URL to begin editing instantly.
              </p>

              {/* Actions */}
              <div className="mt-8 space-y-5">
                {/* Upload Button */}
                <button
                  onClick={() =>
                    document
                      .querySelector<HTMLInputElement>('input[type="file"]')
                      ?.click()
                  }
                  className="group w-full py-4 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                >
                  <Upload
                    size={18}
                    className="group-hover:-translate-y-px transition"
                  />
                  Upload PDF
                </button>

                {/* Drag hint */}
                <p className="text-xs text-slate-400">
                  or drag & drop a PDF file here
                </p>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    or
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* URL Input */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Paste a public PDF URL and press Enter"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleLoadFromUrl(e.currentTarget.value);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EDITOR AREA */}
        {originalPdfSource && (
          <div className="flex items-start w-full h-full relative">
            {/* Floating Zoom Controls */}
            <div className="fixed bottom-8 right-8 z-60 flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-1.5 transition-all hover:scale-[1.05]">
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                title="Zoom Out"
              >
                <Minus size={18} />
              </button>
              <div className="px-3 text-sm font-bold text-gray-900 min-w-14 text-center">
                {zoomScale}%
              </div>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                title="Zoom In"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Mobile Backdrop */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Left Sidebar Container */}
            <div
              className={`fixed inset-y-0 left-0 z-40 h-full bg-gray-50 border-r border-gray-200 transition-transform duration-300 ease-in-out w-[80%] max-w-[320px] md:relative md:translate-x-0 md:w-[20%] md:max-w-none md:flex md:flex-col ${
                isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
              }`}
            >
              <div className="flex items-center border-b border-gray-200 bg-white">
                <button
                  className={`flex-1 py-2 text-xs font-medium uppercase tracking-wide ${
                    activeSidebar === "thumbnails"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  onClick={() => setActiveSidebar("thumbnails")}
                >
                  Thumbnails
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-medium uppercase tracking-wide ${
                    activeSidebar === "search"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  onClick={() => setActiveSidebar("search")}
                >
                  Search
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                {activeSidebar === "thumbnails" ? (
                  <Sidebar
                    pdfFile={fileUrl as string}
                    pageNumber={pageNumber}
                    setPageNumber={goToPage}
                    // setNumberPages={setNumberPages}
                    pages={pages}
                    setPages={setPages}
                    pageCanvasData={pageCanvasData}
                    setPageCanvasData={setPageCanvasData}
                  />
                ) : (
                  <SearchSidebar
                    pdfDocument={pdfDocument}
                    onResultClick={(page, _item) => {
                      goToPage(page);
                    }}
                  />
                )}
              </div>
            </div>

            {/* PDF Body Container */}
            <div className="w-full md:w-[80%] h-full">
              <PDFBody
                currentPage={pageNumber}
                zoom={zoomScale}
                viewerRef={viewerRef as RefObject<HTMLDivElement>}
                pdfPageRef={pdfPageRef as RefObject<HTMLDivElement>}
                pdfOverlayContainerRef={
                  pdfOverlayContainerRef as RefObject<HTMLDivElement>
                }
                hideContextMenu={hideContextMenu}
                contextMenu={contextMenu}
                pdfOverlayFabricRef={pdfOverlayFabricRef}
                fileUrl={fileUrl as string}
                handlePageOnloadSuccess={handlePageOnloadSuccess}
                handleDocumentLoad={handleDocumentLoad}
                pageNumber={pages[pageNumber - 1]?.page || pageNumber}
                handleLoadError={(error: Error) => {
                  console.error("PDF Load Error:", error);
                  toast.error("Failed to load PDF page");
                  setIsLoading(false);
                }}
              >
                {activeTool === "draw" && lastDrawingBounds && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFinishDrawing();
                    }}
                    style={{
                      position: "absolute",
                      left:
                        (lastDrawingBounds.left +
                          lastDrawingBounds.width +
                          10) *
                        (zoomScale / 100),
                      top: lastDrawingBounds.top * (zoomScale / 100),
                      zIndex: 50,
                    }}
                    className="p-2 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all animate-in fade-in zoom-in duration-200"
                    title="Done Drawing"
                  >
                    <Check size={20} />
                  </button>
                )}
              </PDFBody>
            </div>
          </div>
        )}
      </div>

      {/* DRAWING BOX REMOVED - Direct drawing on PDF enabled */}
    </div>
  );
}

export default PdfEditor;
