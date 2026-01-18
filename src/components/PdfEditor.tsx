import {
  Canvas,
  Circle,
  FabricImage,
  PencilBrush,
  Rect,
  Textbox,
} from "fabric";
import { HistoryManager } from "../utils/HistoryManager";
import { PDFDocument } from "pdf-lib";
import React, { useEffect, useRef, useState, type RefObject } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaEraser, FaRedo, FaUndo } from "react-icons/fa";
import { FileText, Upload, Search, Plus, Minus } from "lucide-react";

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [startedDrawing, setStartedDrawing] = useState(false);
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
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [penColor, setPenColor] = useState("#000000");
  const [penSize, setPenSize] = useState(3);
  const pdfOverlayContainerRef = useRef<HTMLDivElement | null>(null); // for Fabric overlay
  const pdfOverlayFabricRef = useRef<Canvas | null>(null); // for Fabric instance
  const [canvasInstance, setCanvasInstance] = useState<Canvas | null>(null);
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const canvaContainerRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [pageCanvasData, setPageCanvasData] = useState<Record<string, string>>(
    {},
  );
  let isHighlighting = false;
  let highlightRect: Rect | null = null;
  let startX = 0;
  let startY = 0;
  const [extractedText, setExtractedText] = useState<PdfTextItem[]>([]);

  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl || null);
  const pdfPageRef = useRef<HTMLDivElement | null>(null);
  const [pdfSize, setPdfSize] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState("text");
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
  // const AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const lastAutoSaveRef = useRef<number>(Date.now());
  const hasInitialVersionRef = useRef<boolean>(false);

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

  const saveCurrentPageState = (index = pageNumber, force = false) => {
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
  };

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
      console.warn("❌ [Navigation] Error during page switch", error);
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
        console.warn(`❌ [Load] Failed for page ID ${pageId}`, error);
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
    if (activeTool !== "draw") return;

    const container = canvasContainerRef.current;
    if (!container) return;
    if (fabricRef.current) return;

    container.innerHTML = "";

    const canvasEl = document.createElement("canvas");
    canvasEl.width = 300;
    canvasEl.height = 200;
    canvasEl.className = "pointer-events-auto absolute inset-0";
    container.appendChild(canvasEl);

    const canvas = new Canvas(canvasEl, { selection: false });
    const pencil = new PencilBrush(canvas);
    pencil.width = penSize;
    pencil.color = penColor;

    canvas.freeDrawingBrush = pencil;
    canvas.isDrawingMode = true;
    fabricRef.current = canvas;

    const saveState = () => {
      if (lockHistory.current) return;
      const json = JSON.stringify(canvas.toJSON());
      // Use a special IDs for the drawing box, or just ignore for now if it's separate.
      // But to match types:
      undoStack.current.push({
        pageId: "drawing-box",
        pageNumber: 0,
        json,
      });
      redoStack.current = [];
    };

    saveState();
    canvas.on("path:created", saveState);
    canvas.on("object:modified", saveState);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      container.innerHTML = "";
    };
  }, [activeTool, penSize, penColor]);

  useEffect(() => {
    const canvaElement = canvaContainerRef.current;
    const dragHandle = dragHandleRef.current;
    if (!canvaElement || !dragHandle) return;

    let isDragging = false;
    let offSetX = 0;
    let offSetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      canvaElement.style.left = `${e.clientX - offSetX}px`;
      canvaElement.style.top = `${e.clientY - offSetY}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (isDrawing) return;
      isDragging = true;
      offSetX = e.clientX - canvaElement.offsetLeft;
      offSetY = e.clientY - canvaElement.offsetTop;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    dragHandle.addEventListener("mousedown", onMouseDown);
    return () => dragHandle.removeEventListener("mousedown", onMouseDown);
  }, [isDrawing]);

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

      if (
        (target.pdfMeta?.type === "text" && activeToolRef.current === "edit") ||
        target.pdfMeta?.type === "image" ||
        target.pdfMeta?.type === "shape"
      ) {
        showContextMenu(target.pdfMeta, evt.clientX, evt.clientY);
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

  const handleExportDrawingToPdf = async () => {
    try {
      const dataUrl = fabricRef.current?.toDataURL({
        format: "png",
        multiplier: 2,
      });
      if (!dataUrl || !pdfOverlayFabricRef.current) return;

      const imgElement = new Image();
      imgElement.crossOrigin = "anonymous";
      imgElement.addEventListener("load", () => {
        const scaleX = pdfSize.width / imgElement.width;
        const scaleY = pdfSize.height / imgElement.height;
        const scale = Math.min(scaleX, scaleY);

        const img = new FabricImage(imgElement, {
          left: 50,
          top: 50,
          selectable: true,
          scaleX: scale,
          scaleY: scale,
        });

        pdfOverlayFabricRef.current?.add(img);
        pdfOverlayFabricRef.current?.setActiveObject(img);
        pdfOverlayFabricRef.current?.renderAll();
        setTimeout(saveCurrentPageState, 200);
      });
      imgElement.src = dataUrl;
    } catch (error) {
      console.error("Error in export process:", error);
    }
  };

  const handleDeleteCanva = () => {
    const activeObject = pdfOverlayFabricRef.current?.getActiveObject();
    if (activeObject) {
      pdfOverlayFabricRef.current?.remove(activeObject);
      pdfOverlayFabricRef.current?.discardActiveObject();
      pdfOverlayFabricRef.current?.renderAll();
    }
  };

  const handleClearCanvas = () => fabricRef.current?.clear();

  const [fontSize, setFontSize] = useState("12");
  const [fontFamily, setFontFamily] = useState("Arial");

  const handleAddText = () => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    const textBox = new Textbox("Enter text here", {
      left: 100,
      top: 100,
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

    canvas.on("mouse:down", onMouseDown);
    canvas.on("object:modified", onModification);
    canvas.on("object:added", onModification);
    canvas.on("object:removed", onModification);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("object:modified", onModification);
      canvas.off("object:added", onModification);
      canvas.off("object:removed", onModification);
    };
  }, [pageNumber, pages, canvasInstance]);

  const undo = async () => {
    if (undoStack.current.length === 0) return;
    lockHistory.current = true;

    const prevState = undoStack.current.pop()!;

    // -- Special handling for Drawing Box --
    if (prevState.pageId === "drawing-box") {
      const canvas = fabricRef.current;
      if (canvas) {
        redoStack.current.push({
          ...prevState,
          json: JSON.stringify(canvas.toJSON()),
        });
        await canvas.loadFromJSON(prevState.json);
        canvas.renderAll();
      }
      lockHistory.current = false;
      return;
    }

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

    // -- Special handling for Drawing Box --
    if (nextState.pageId === "drawing-box") {
      const canvas = fabricRef.current;
      if (canvas) {
        undoStack.current.push({
          ...nextState,
          json: JSON.stringify(canvas.toJSON()),
        });
        await canvas.loadFromJSON(nextState.json);
        canvas.renderAll();
      }
      lockHistory.current = false;
      return;
    }

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

  const activateHighlightMode = () => {
    if (activeTool === "highlight") return;
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = false;
    canvas.defaultCursor = "crosshair";
    canvas.on("mouse:down", startHighlighting);
    setActiveTool("highlight");
  };

  const startHighlighting = (opt: any) => {
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

    isHighlighting = true;
    startX = pointer.x;
    startY = pointer.y;
    highlightRect = new Rect({
      left: startX,
      top: startY,
      width: 0,
      height: 0,
      fill: "yellow",
      opacity: 0.4,
      pdfMeta: { type: "highlight", source: "manual" },
    });
    canvas.add(highlightRect);
    canvas.on("mouse:move", updateHighlight);
    canvas.on("mouse:up", finishHighlight);
  };

  const updateHighlight = (opt: any) => {
    if (!isHighlighting || !highlightRect || !pdfOverlayFabricRef.current)
      return;
    const pointer = pdfOverlayFabricRef.current.getPointer(opt.e);
    highlightRect.set({
      width: Math.abs(pointer.x - startX),
      height: Math.abs(pointer.y - startY),
      left: Math.min(pointer.x, startX),
      top: Math.min(pointer.y, startY),
    });
    pdfOverlayFabricRef.current.renderAll();
  };

  const finishHighlight = () => {
    if (pdfOverlayFabricRef.current) {
      isHighlighting = false;
      highlightRect = null;
      pdfOverlayFabricRef.current.off("mouse:move", updateHighlight);
      pdfOverlayFabricRef.current.off("mouse:up", finishHighlight);
      setTimeout(saveCurrentPageState, 100);
    }
  };

  const handleAddShape = (type: string) => {
    const canvas = pdfOverlayFabricRef.current;
    if (!canvas) return;
    let shape: any;
    if (type === "rect")
      shape = new Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 100,
        fill: "transparent",
        stroke: selectedColor,
        strokeWidth: 2,
        pdfMeta: { type: "shape", shape: "rect" },
      });
    else if (type === "circle")
      shape = new Circle({
        left: 150,
        top: 150,
        radius: 50,
        fill: "transparent",
        stroke: selectedColor,
        strokeWidth: 2,
        pdfMeta: { type: "shape", shape: "circle" },
      });
    else if (type === "redact")
      shape = new Rect({
        left: 100,
        top: 100,
        width: 150,
        height: 50,
        fill: "black",
        pdfMeta: { type: "redact-preview" },
      });

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
      setTimeout(saveCurrentPageState, 100);
    }
  };

  const pdfId = fileUrl || "default-pdf";

  const handleSaveDocument = async () => {
    try {
      if (!originalPdfSource) return toast.error("No PDF loaded");

      saveCurrentPageState(pageNumber);
      const existingPdfBytes = await getOriginalPdfBytes(originalPdfSource);
      const originalPdfDoc = await PDFDocument.load(existingPdfBytes);
      const newPdfDoc = await PDFDocument.create();

      const tempCanvasEl = document.createElement("canvas");
      tempCanvasEl.width = pdfSize.width || 595;
      tempCanvasEl.height = pdfSize.height || 842;
      const tempFabricCanvas = new Canvas(tempCanvasEl);

      // Determine the scale factor between screen pixels (pdfSize) and PDF points
      const currentPdfPage = originalPdfDoc.getPages()[pageNumber - 1];
      const { width: currentPdfWidth } = currentPdfPage.getSize();
      const scaleFactor = currentPdfWidth / pdfSize.width;

      for (const item of pages) {
        const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [
          item.page - 1,
        ]);
        newPdfDoc.addPage(copiedPage);

        const savedState = pageCanvasData[item.id];
        if (savedState) {
          await tempFabricCanvas.loadFromJSON(savedState);

          // Scale objects to match PDF dimensions
          const objects = tempFabricCanvas.getObjects();
          objects.forEach((obj: any) => {
            obj.scaleX = (obj.scaleX || 1) * scaleFactor;
            obj.scaleY = (obj.scaleY || 1) * scaleFactor;
            obj.left = (obj.left || 0) * scaleFactor;
            obj.top = (obj.top || 0) * scaleFactor;
            obj.setCoords();
          });

          tempFabricCanvas.renderAll();
          const dataUrl = tempFabricCanvas.toDataURL({
            format: "png",
            multiplier: 2,
          });
          const embeddedImage = await newPdfDoc.embedPng(
            await fetch(dataUrl).then((r) => r.arrayBuffer()),
          );
          const { width, height } = copiedPage.getSize();
          copiedPage.drawImage(embeddedImage, { x: 0, y: 0, width, height });
          tempFabricCanvas.clear();
        }
      }

      const pdfBytes = await newPdfDoc.save();

      if (onSave) {
        onSave(pdfBytes, fileName);
        return;
      }

      const url = URL.createObjectURL(
        new Blob([pdfBytes as any], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "annotated_document.pdf";
      link.click();
      toast.success("Document saved successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save document");
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

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      const data = f.target?.result as string;
      if (data && pdfOverlayFabricRef.current) {
        FabricImage.fromURL(data).then((img) => {
          img.set({ left: 100, top: 100, scaleX: 0.5, scaleY: 0.5 });
          pdfOverlayFabricRef.current?.add(img);
          pdfOverlayFabricRef.current?.setActiveObject(img);
        });
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
        onSave={handleSaveDocument}
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
        handleShowDrawingBox={() => {
          setActiveTool("draw");
          setStartedDrawing(true);
        }}
        handleAddImage={handleAddImage}
        onUndo={undo}
        onRedo={redo}
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

            {/* Left Sidebar Container */}
            <div className="w-[20%] h-full flex flex-col border-r border-gray-200 bg-gray-50 z-20">
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
            <div className="w-[80%] h-full">
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
              />
            </div>
          </div>
        )}
      </div>

      {/* DRAWING BOX */}
      {activeTool === "draw" && (
        <div
          ref={canvaContainerRef}
          className="fixed top-24 left-1/2 -translate-x-1/2 bg-white shadow-2xl border border-gray-200 rounded-xl z-9999"
          style={{ width: 380, height: 260 }}
        >
          <div
            ref={dragHandleRef}
            className="cursor-move flex justify-between items-center px-4 py-2 bg-gray-100/80 backdrop-blur-sm border-b border-gray-200 rounded-t-xl"
          >
            <span className="text-[13px] font-medium text-gray-700">
              Draw box
            </span>
            <div className="flex items-center gap-3">
              {startedDrawing && (
                <>
                  <button
                    onClick={handleClearCanvas}
                    title="Erase"
                    className="text-gray-500 hover:text-red-500 transition"
                  >
                    <FaEraser size={16} />
                  </button>
                  <button
                    onClick={handleExportDrawingToPdf}
                    title="Save Signature"
                    className="text-gray-500 hover:text-green-600 transition"
                  >
                    <FaCheck size={16} />
                  </button>
                </>
              )}
              <div className="flex items-center gap-3 mr-3">
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer"
                />
                <select
                  value={penSize}
                  onChange={(e) => setPenSize(Number(e.target.value))}
                  className="text-xs bg-gray-100 border border-gray-300 rounded px-1 py-0.5"
                >
                  <option value={2}>Thin</option>
                  <option value={4}>Medium</option>
                  <option value={6}>Thick</option>
                  <option value={8}>Extra Thick</option>
                </select>
                <button
                  onClick={undo}
                  title="Undo"
                  className="text-gray-500 hover:text-blue-500 transition"
                >
                  <FaUndo size={15} />
                </button>
                <button
                  onClick={redo}
                  title="Redo"
                  className="text-gray-500 hover:text-blue-500 transition"
                >
                  <FaRedo size={15} />
                </button>
              </div>
              <button
                onClick={() => {
                  setActiveTool("text");
                  setStartedDrawing(false);
                }}
                title="Close"
                className="text-gray-500 hover:text-red-500 transition"
              >
                ✕
              </button>
            </div>
          </div>
          <div
            className="relative w-full h-[calc(100%-44px)] bg-white rounded-b-xl"
            onMouseDown={() => {
              setIsDrawing(true);
              setStartedDrawing(true);
            }}
            onMouseUp={() => setIsDrawing(false)}
          >
            {!startedDrawing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm pointer-events-none select-none z-10">
                <div className="flex items-center gap-2">
                  <span>✍️</span>
                  <span>Draw your signature</span>
                </div>
              </div>
            )}
            <div
              className="absolute inset-0 z-20 rounded-b-xl"
              ref={canvasContainerRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfEditor;
