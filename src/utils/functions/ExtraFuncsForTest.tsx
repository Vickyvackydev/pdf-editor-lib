// // ============================================
// // COMPLETE FIX FOR OBJECT PERSISTENCE
// // ============================================

// // In PdfEditor.tsx - Add these state/refs at the top with your other declarations:

// const isNavigatingRef = useRef(false);
// const isSavingRef = useRef(false);
// const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// // ============================================
// // 1. FIXED saveCurrentPageState
// // ============================================
// const saveCurrentPageState = (page = pageNumber) => {
//   const canvas = pdfOverlayFabricRef.current;

//   // Don't save if:
//   // - No canvas
//   // - No page number
//   // - Currently navigating
//   // - Currently in the middle of loading
//   if (!canvas || !page || isNavigatingRef.current) {
//     console.log(`[save] skipped - navigating or no canvas`);
//     return null;
//   }

//   const json = serializeCanvasForPage(canvas);
//   if (!json) return null;

//   // Mark that we're saving
//   isSavingRef.current = true;

//   // Update Ref IMMEDIATELY (synchronous)
//   pageCanvasDataRef.current = {
//     ...pageCanvasDataRef.current,
//     [page]: json,
//   };

//   // Update state (asynchronous)
//   setPageCanvasData((prev) => ({
//     ...prev,
//     [page]: json,
//   }));

//   console.log(
//     `✅ [save] Saved page ${page} (${canvas.getObjects().length} objects)`
//   );

//   // Release save lock after a short delay
//   setTimeout(() => {
//     isSavingRef.current = false;
//   }, 50);

//   return json;
// };

// // ============================================
// // 2. FIXED goToPage with proper sequencing
// // ============================================
// const goToPage = async (targetPage: number) => {
//   if (targetPage === pageNumber) return;
//   if (targetPage < 1 || targetPage > numberPages) return;

//   console.log(`🔄 [Navigation] Starting: ${pageNumber} → ${targetPage}`);

//   // Set navigation lock FIRST
//   isNavigatingRef.current = true;

//   try {
//     // 1. Save current page state
//     console.log(`💾 [Navigation] Saving current page ${pageNumber}...`);
//     const savedJson = saveCurrentPageState(pageNumber);

//     if (savedJson) {
//       console.log(`✅ [Navigation] Page ${pageNumber} saved successfully`);
//     }

//     // 2. Wait for save to complete
//     await new Promise((resolve) => setTimeout(resolve, 100));

//     // 3. Reset load tracker to force reload of new page
//     lastLoadedPage.current = 0;

//     // 4. Update page number (triggers load effect)
//     console.log(`📄 [Navigation] Switching to page ${targetPage}...`);
//     setPageNumber(targetPage);
//   } catch (error) {
//     console.error("❌ [Navigation] Error:", error);
//   } finally {
//     // Release navigation lock after sufficient delay for load to complete
//     setTimeout(() => {
//       isNavigatingRef.current = false;
//       console.log(`✅ [Navigation] Complete: now on page ${targetPage}`);
//     }, 300);
//   }
// };

// // ============================================
// // 3. FIXED centralized loading effect
// // ============================================
// useEffect(() => {
//   const canvas = pdfOverlayFabricRef.current;
//   if (!canvas || !pageNumber) return;

//   // Don't load if:
//   // - Already loaded this page
//   // - Currently navigating
//   // - Currently saving
//   if (lastLoadedPage.current === pageNumber) {
//     console.log(`⏭️ [Load] Skipping page ${pageNumber} - already loaded`);
//     return;
//   }

//   if (isNavigatingRef.current || isSavingRef.current) {
//     console.log(`⏸️ [Load] Delaying load - navigation/save in progress`);
//     return;
//   }

//   const load = async () => {
//     try {
//       console.log(`📖 [Load] Loading page ${pageNumber}...`);

//       // Use the ref (always has latest data)
//       await loadPageState(
//         pageNumber,
//         pdfOverlayFabricRef,
//         pageCanvasDataRef.current
//       );

//       lastLoadedPage.current = pageNumber;
//       console.log(
//         `✅ [Load] Page ${pageNumber} loaded (${
//           canvas.getObjects().length
//         } objects)`
//       );
//     } catch (error) {
//       console.error(`❌ [Load] Failed to load page ${pageNumber}:`, error);
//       // Even on error, mark as loaded to prevent infinite retry
//       lastLoadedPage.current = pageNumber;
//     }
//   };

//   // Delay to ensure canvas is stable and previous operations complete
//   const timer = setTimeout(load, 200);

//   return () => {
//     clearTimeout(timer);
//   };
// }, [pageNumber, pdfSize.width, pdfSize.height]);

// // ============================================
// // 4. FIXED auto-save on modifications
// // ============================================
// useEffect(() => {
//   const canvas = pdfOverlayFabricRef.current;
//   if (!canvas) return;

//   const handleModification = () => {
//     // Clear any pending save
//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//     }

//     // Debounce saves - only save after 150ms of no changes
//     saveTimeoutRef.current = setTimeout(() => {
//       // Don't save during navigation
//       if (!isNavigatingRef.current && !isSavingRef.current) {
//         console.log(`🔄 [Auto-save] Modification detected`);
//         saveCurrentPageState();
//       }
//     }, 150);
//   };

//   // Attach modification listeners
//   canvas.on("object:modified", handleModification);
//   canvas.on("object:added", handleModification);
//   canvas.on("object:removed", handleModification);

//   console.log(`👂 [Auto-save] Listeners attached for page ${pageNumber}`);

//   return () => {
//     // Clean up listeners
//     canvas.off("object:modified", handleModification);
//     canvas.off("object:added", handleModification);
//     canvas.off("object:removed", handleModification);

//     // Clear pending save
//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//     }

//     console.log(`🔇 [Auto-save] Listeners removed`);
//   };
// }, []); // ✅ Only set up once

// // ============================================
// // 5. FIXED canvas initialization
// // ============================================
// useEffect(() => {
//   const container = pdfOverlayContainerRef.current;
//   if (!container || !pdfSize.width || !pdfSize.height) return;

//   console.log(`🎨 [Canvas] Initializing ${pdfSize.width}x${pdfSize.height}`);

//   container.innerHTML = "";

//   const el = document.createElement("canvas");
//   el.width = pdfSize.width;
//   el.height = pdfSize.height;
//   container.append(el);

//   const fabricCanvas = new Canvas(el, {
//     selection: true,
//     preserveObjectStacking: true,
//     width: pdfSize.width,
//     height: pdfSize.height,
//   });

//   pdfOverlayFabricRef.current = fabricCanvas;

//   fabricCanvas.on("mouse:down", (opt) => {
//     const evt = opt.e as MouseEvent;
//     const target = opt.target as any;

//     if (!target) return hideContextMenu();

//     if (target.pdfMeta?.type === "text" && activeToolRef.current === "edit") {
//       showContextMenu(target.pdfMeta, evt.clientX, evt.clientY);
//     }
//     if (target.pdfMeta?.type === "image") {
//       showContextMenu(target.pdfMeta, evt.clientX, evt.clientY);
//     }
//     if (target.pdfMeta?.type === "shape") {
//       showContextMenu(target.pdfMeta, evt.clientX, evt.clientY);
//     }
//   });

//   console.log(`✅ [Canvas] Initialized successfully`);

//   return () => {
//     console.log(`🗑️ [Canvas] Disposing...`);

//     // Save before disposing if not navigating
//     if (!isNavigatingRef.current && fabricCanvas.getObjects().length > 0) {
//       const json = serializeCanvasForPage(fabricCanvas);
//       if (json) {
//         pageCanvasDataRef.current = {
//           ...pageCanvasDataRef.current,
//           [pageNumber]: json,
//         };
//         console.log(`💾 [Canvas] Saved before dispose`);
//       }
//     }

//     fabricCanvas.dispose();
//     pdfOverlayFabricRef.current = null;
//   };
// }, [pdfSize.width, pdfSize.height]);

// // ============================================
// // 6. IMPROVED text hitboxes - don't interfere
// // ============================================
// useEffect(() => {
//   const canvas = pdfOverlayFabricRef.current;
//   if (!canvas) return;

//   console.log(`📝 [Hitboxes] Updating for ${extractedText.length} text items`);

//   // Remove ONLY old pdf-text hitboxes
//   const oldHitboxes = canvas
//     .getObjects()
//     .filter((o: any) => o.type === "pdf-text");
//   oldHitboxes.forEach((o) => canvas.remove(o));

//   // Add new hitboxes
//   extractedText.forEach((item) => {
//     const box = new Rect({
//       left: item.x,
//       top: item.y - item.height,
//       width: item.width,
//       height: item.height,
//       fill: "rgba(0,0,0,0)",
//       selectable: false,
//       evented: true,
//       type: "pdf-text",
//       pdfMeta: { type: "text", ...item },
//       hoverCursor: "text",
//     });
//     canvas.add(box);
//   });

//   // Send all hitboxes to back so they don't cover user objects
//   const hitboxes = canvas
//     .getObjects()
//     .filter((o: any) => o.type === "pdf-text");
//   hitboxes.forEach((box) => canvas.sendObjectToBack(box));

//   canvas.renderAll();
//   console.log(`✅ [Hitboxes] Updated (${hitboxes.length} hitboxes)`);
// }, [extractedText]);

// // ============================================
// // 7. UPDATED functions that trigger saves
// // ============================================

// const handleAddText = () => {
//   const canvas = pdfOverlayFabricRef.current;
//   if (!canvas) return;

//   const textBox = new Textbox("Enter text here", {
//     left: 100,
//     top: 100,
//     fontSize: Number(fontSize),
//     fill: "#000",
//     fontFamily: fontFamily,
//     editable: true,
//     hasBorders: true,
//     hasControls: true,
//     borderColor: "blue",
//     cornerColor: "blue",
//     pdfMeta: { type: "text-object" }, // Mark as user object
//   });

//   canvas.add(textBox);
//   canvas.setActiveObject(textBox);
//   canvas.renderAll();

//   // Auto-save will handle this via modification event
//   console.log(`➕ [Text] Added new text box`);
// };

// const handleAddShape = (type: string) => {
//   const canvas = pdfOverlayFabricRef.current;
//   if (!canvas) return;

//   let shape;
//   if (type === "rect") {
//     shape = new Rect({
//       left: 100,
//       top: 100,
//       width: 100,
//       height: 100,
//       fill: "transparent",
//       stroke: selectedColor,
//       strokeWidth: 2,
//       selectable: true,
//       pdfMeta: { type: "shape", shape: "rect" },
//     });
//   } else if (type === "circle") {
//     shape = new Circle({
//       left: 150,
//       top: 150,
//       radius: 50,
//       fill: "transparent",
//       stroke: selectedColor,
//       strokeWidth: 2,
//       selectable: true,
//       pdfMeta: { type: "shape", shape: "circle" },
//     });
//   } else if (type === "redact") {
//     shape = new Rect({
//       left: 100,
//       top: 100,
//       width: 150,
//       height: 50,
//       fill: "black",
//       stroke: "black",
//       strokeWidth: 0,
//       selectable: true,
//       pdfMeta: { type: "redact-preview" },
//     });
//   } else if (type === "note") {
//     shape = new Textbox("Sticky Note", {
//       left: 100,
//       top: 100,
//       width: 150,
//       fontSize: 14,
//       fill: "#000",
//       backgroundColor: "#fef08a",
//       fontFamily: "Arial",
//       hasBorders: true,
//       hasControls: true,
//       borderColor: "#eab308",
//       padding: 10,
//       pdfMeta: { type: "sticky-note" },
//     });
//   }

//   if (shape) {
//     canvas.add(shape);
//     canvas.setActiveObject(shape);
//     canvas.renderAll();
//     console.log(`➕ [Shape] Added ${type}`);
//     // Auto-save will handle this via modification event
//   }
// };

// // ============================================
// // 8. DEBUG HELPER - Temporary diagnostic tool
// // ============================================
// const debugState = () => {
//   console.log("═══════════════════════════════");
//   console.log("📊 DEBUG STATE");
//   console.log("═══════════════════════════════");
//   console.log("Current page:", pageNumber);
//   console.log("Last loaded:", lastLoadedPage.current);
//   console.log("Is navigating:", isNavigatingRef.current);
//   console.log("Is saving:", isSavingRef.current);
//   console.log(
//     "Canvas objects:",
//     pdfOverlayFabricRef.current?.getObjects().length
//   );
//   console.log("Saved pages:", Object.keys(pageCanvasDataRef.current));
//   console.log("─────────────────────────────────");
//   Object.entries(pageCanvasDataRef.current).forEach(([page, data]) => {
//     const parsed = JSON.parse(data as string);
//     console.log(`  Page ${page}: ${parsed.objects?.length || 0} objects`);
//   });
//   console.log("═══════════════════════════════");
// };

// // Add this button to your JSX for debugging (remove after testing):
// // <button
// //   onClick={debugState}
// //   className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] hover:bg-blue-700"
// // >
// //   🔍 Debug
// // </button>

// // Fixed utility functions for object persistence
// // Place these in your utils file

// import { Canvas, util } from "fabric";

// /**
//  * Clears all non-text objects from canvas (keeps PDF text hitboxes)
//  */
// export const clearNonTextObjects = (canvas: Canvas) => {
//   const objectsToRemove = canvas
//     .getObjects()
//     .filter((obj: any) => obj.type !== "pdf-text");

//   objectsToRemove.forEach((obj) => canvas.remove(obj));

//   console.log(`🧹 [Clear] Removed ${objectsToRemove.length} non-text objects`);
// };

// /**
//  * Serializes canvas to JSON, excluding PDF text hitboxes
//  */
// export const serializeCanvasForPage = (
//   canvas: Canvas | null
// ): string | null => {
//   if (!canvas) {
//     console.warn("⚠️ [Serialize] No canvas provided");
//     return null;
//   }

//   // Get only user-created objects (exclude pdf-text hitboxes)
//   const objectsToSave = canvas
//     .getObjects()
//     .filter((obj: any) => obj.type !== "pdf-text");

//   if (objectsToSave.length === 0) {
//     console.log("📝 [Serialize] No objects to save");
//     return JSON.stringify({ version: "6.0.0", objects: [] });
//   }

//   const canvasData = {
//     version: "6.0.0",
//     objects: objectsToSave.map((obj: any) => {
//       // Ensure pdfMeta is preserved
//       if (!obj.pdfMeta) {
//         obj.pdfMeta = { type: obj.type || "unknown" };
//       }

//       // Use toJSON with pdfMeta included
//       return obj.toJSON(["pdfMeta"]);
//     }),
//   };

//   const json = JSON.stringify(canvasData);
//   console.log(`📦 [Serialize] Saved ${objectsToSave.length} objects`);

//   return json;
// };

// /**
//  * Loads saved page state into canvas
//  * FIXED: Better error handling and async operations
//  */
// export const loadPageState = async (
//   pageNum: number,
//   pdfOverlayFabricRef: React.RefObject<Canvas | null>,
//   pageCanvasData: Record<number, string>
// ): Promise<void> => {
//   const canvas = pdfOverlayFabricRef.current;

//   if (!canvas) {
//     console.warn("⚠️ [Load] No canvas available yet");
//     return;
//   }

//   const savedData = pageCanvasData[pageNum];

//   // 1. Always clear non-text objects first (keeps hitboxes)
//   clearNonTextObjects(canvas);

//   // 2. If no saved data, just render and exit
//   if (!savedData) {
//     canvas.renderAll();
//     console.log(`📭 [Load] No saved data for page ${pageNum}`);
//     return;
//   }

//   // 3. Parse and validate saved data
//   let data;
//   try {
//     data = JSON.parse(savedData);
//   } catch (err) {
//     console.error(`❌ [Load] Invalid JSON for page ${pageNum}:`, err);
//     canvas.renderAll();
//     return;
//   }

//   // 4. Check if there are objects to load
//   if (!data || !data.objects || data.objects.length === 0) {
//     console.log(`📭 [Load] No objects in saved data for page ${pageNum}`);
//     canvas.renderAll();
//     return;
//   }

//   // 5. Load objects using Fabric's enlivenObjects
//   try {
//     console.log(
//       `📥 [Load] Loading ${data.objects.length} objects for page ${pageNum}...`
//     );

//     // Enliven all objects at once
//     const enlivenedObjects = await util.enlivenObjects(data.objects);

//     // Add all objects to canvas
//     enlivenedObjects.forEach((obj: any) => {
//       canvas.add(obj);
//     });

//     // Ensure hitboxes stay at the back
//     const hitboxes = canvas
//       .getObjects()
//       .filter((o: any) => o.type === "pdf-text");
//     hitboxes.forEach((box) => canvas.sendObjectToBack(box));

//     canvas.renderAll();

//     const totalObjects = canvas.getObjects().length;
//     const userObjects = canvas
//       .getObjects()
//       .filter((o: any) => o.type !== "pdf-text").length;

//     console.log(
//       `✅ [Load] Page ${pageNum} loaded: ${userObjects} user objects, ${totalObjects} total`
//     );
//   } catch (err) {
//     console.error(
//       `❌ [Load] Failed to enliven objects for page ${pageNum}:`,
//       err
//     );

//     // On error, try a fallback: use loadFromJSON
//     try {
//       console.log(`🔄 [Load] Attempting fallback load method...`);

//       await new Promise<void>((resolve, reject) => {
//         canvas.loadFromJSON(
//           savedData,
//           () => {
//             // After loading, remove any pdf-text that might have been saved
//             clearNonTextObjects(canvas);
//             canvas.renderAll();
//             console.log(`✅ [Load] Fallback successful for page ${pageNum}`);
//             resolve();
//           },
//           (err: any) => {
//             console.error(`❌ [Load] Fallback failed:`, err);
//             reject(err);
//           }
//         );
//       });
//     } catch (fallbackErr) {
//       console.error(`❌ [Load] Both load methods failed for page ${pageNum}`);
//       canvas.renderAll();
//     }
//   }
// };

// /**
//  * Get original PDF bytes from various source types
//  */
// export const getOriginalPdfBytes = async (
//   source: string | ArrayBuffer | null
// ): Promise<ArrayBuffer> => {
//   if (!source) {
//     throw new Error("No PDF source provided");
//   }

//   // If already ArrayBuffer, return it
//   if (source instanceof ArrayBuffer) {
//     return source;
//   }

//   // If string (URL), fetch it
//   if (typeof source === "string") {
//     const response = await fetch(source);
//     if (!response.ok) {
//       throw new Error(`Failed to fetch PDF: ${response.statusText}`);
//     }
//     return await response.arrayBuffer();
//   }

//   throw new Error("Invalid PDF source type");
// };

// /**
//  * Helper: Check if page has any saved objects
//  */
// export const pageHasObjects = (
//   pageNum: number,
//   pageCanvasData: Record<number, string>
// ): boolean => {
//   const savedData = pageCanvasData[pageNum];

//   if (!savedData) return false;

//   try {
//     const data = JSON.parse(savedData);
//     return data.objects && data.objects.length > 0;
//   } catch {
//     return false;
//   }
// };

// /**
//  * Helper: Get object count for a page
//  */
// export const getPageObjectCount = (
//   pageNum: number,
//   pageCanvasData: Record<number, string>
// ): number => {
//   const savedData = pageCanvasData[pageNum];

//   if (!savedData) return 0;

//   try {
//     const data = JSON.parse(savedData);
//     return data.objects?.length || 0;
//   } catch {
//     return 0;
//   }
// };

// /**
//  * Helper: Debug all saved pages
//  */
// export const debugAllPages = (pageCanvasData: Record<number, string>) => {
//   console.log("═════════════════════════════");
//   console.log("📚 ALL SAVED PAGES");
//   console.log("═════════════════════════════");

//   const pages = Object.keys(pageCanvasData)
//     .map(Number)
//     .sort((a, b) => a - b);

//   if (pages.length === 0) {
//     console.log("No pages saved yet");
//   } else {
//     pages.forEach((pageNum) => {
//       const count = getPageObjectCount(pageNum, pageCanvasData);
//       console.log(`  Page ${pageNum}: ${count} objects`);
//     });
//   }

//   console.log("═════════════════════════════");
// };
