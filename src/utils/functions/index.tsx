import { Canvas, Rect, Textbox, util } from "fabric";
import type React from "react";

export const handleEditPdfText = (
  textItem: any,
  pdfOverlayFabricRef: React.RefObject<Canvas | null>,
  hideContextMenu: () => void
) => {
  hideContextMenu?.();
  const canvas = pdfOverlayFabricRef?.current;
  if (!canvas) return;

  const PADDING_X = 2;
  const PADDING_Y = 2;

  // 1. Create mask to hide original text
  const mask = new Rect({
    left: textItem.x - PADDING_X,
    top: textItem.y - textItem.height - PADDING_Y,
    width: textItem.width + PADDING_X * 2,
    height: textItem.height + PADDING_Y * 2,
    fill: "white",
    selectable: true,
    evented: true,
    pdfMeta: { type: "text-mask" },
  } as any);

  // 2. Create the editable text box
  const textBox = new Textbox(textItem.str, {
    left: textItem.x,
    top: textItem.y - textItem.height, // Refined alignment
    fontSize: textItem.fontSize,
    width: textItem.width * 1.1,
    fill: "black",
    fontFamily: textItem.fontName || "Arial",
    hasBorders: true,
    hasControls: true,
    borderColor: "blue",
    cornerColor: "blue",
    pdfMeta: { type: "text-replacement" },
  } as any);

  canvas.add(mask);
  canvas.add(textBox);

  // 3. Enter editing mode
  canvas.setActiveObject(textBox);
  textBox.enterEditing();
  textBox.selectAll();

  canvas.renderAll();
};

export const handleMaskPdfText = (
  textItem: any,
  pdfOverlayFabricRef: React.RefObject<Canvas | null>,
  hideContextMenu: () => void
) => {
  hideContextMenu?.();

  const canvas = pdfOverlayFabricRef?.current;
  if (!canvas) return;

  const rect = new Rect({
    left: textItem.x,
    top: textItem.y - textItem.height,
    width: textItem.width,
    height: textItem.height,
    fill: "white",
    selectable: true,
  });

  canvas.add(rect);
  canvas.renderAll();
};

export const handleReplacePdfText = (
  textItem: any,
  pdfOverlayFabricRef: React.RefObject<Canvas | null>,
  hideContextMenu: () => void
) => {
  hideContextMenu();
  const canvas = pdfOverlayFabricRef?.current;
  if (!canvas) return;

  // 1. Create the mask (independent object)
  // Add slight padding to satisfy "Improve mask coverage"
  const PADDING_X = 2;
  const PADDING_Y = 2;

  const mask = new Rect({
    left: textItem.x - PADDING_X,
    top: textItem.y - textItem.height - PADDING_Y,
    width: textItem.width + PADDING_X * 2,
    height: textItem.height + PADDING_Y * 2,
    fill: "white",
    selectable: true, // Allow user to adjust mask if needed
    evented: true,
    pdfMeta: { type: "text-mask" }, // Tag it
  } as any);

  // 2. Create the replacement text (independent object)
  const textBox = new Textbox(textItem.str, {
    left: textItem.x,
    top: textItem.y - textItem.height,
    fontSize: textItem.fontSize,
    fill: "black",
    fontFamily: textItem.fontName || "Arial", // Try to match font if available
    width: textItem.width, // Start with same width
    hasBorders: true,
    hasControls: true,
    borderColor: "#3b82f6", // tailwind blue-500
    cornerColor: "#3b82f6",
    pdfMeta: { type: "text-replacement" },
  } as any);

  // 3. Add both to canvas
  canvas.add(mask);
  canvas.add(textBox);

  canvas.renderAll();
};

export const getOriginalPdfBytes = async (
  originalPdfSource: string | ArrayBuffer | null
): Promise<ArrayBuffer> => {
  if (!originalPdfSource) {
    throw new Error("No PDF source available");
  }

  // If already ArrayBuffer, return it

  if (originalPdfSource instanceof ArrayBuffer) {
    return originalPdfSource;
  }

  // If it's a string (URL), fetch it
  if (typeof originalPdfSource === "string") {
    const response = await fetch(originalPdfSource);
    if (!response.ok) throw new Error("Failed to fetch pdf");
    return await response.arrayBuffer();
  }

  throw new Error("Invalid PDF source type");
};

export const serializeCanvasForPage = (
  canvas: Canvas | null
): string | null => {
  if (!canvas) {
    console.warn("⚠️ [Serialize] No canvas provided");
    return null;
  }

  // Get only user-created objects (exclude hitboxes)
  const objectsToSave = canvas
    .getObjects()
    .filter((obj: any) => !obj.isHitbox && obj.pdfMeta?.type !== "text");

  if (objectsToSave.length === 0) {
    console.log("📝 [Serialize] No user objects to save");
    return JSON.stringify({ version: "6.0.0", objects: [] });
  }

  const canvasData = {
    version: "6.0.0",
    objects: objectsToSave.map((obj: any) => {
      // Ensure pdfMeta is preserved
      if (!obj.pdfMeta) {
        obj.pdfMeta = { type: obj.type || "unknown" };
      }
      // Use toJSON with pdfMeta included
      return obj.toJSON(["pdfMeta"]);
    }),
  };

  const json = JSON.stringify(canvasData);
  console.log(`📦 [Serialize] Serialized ${objectsToSave.length} user objects`);
  return json;
};

export const clearNonTextObjects = (canvas: Canvas) => {
  const objectsToRemove = canvas
    .getObjects()
    .filter((obj: any) => !obj.isHitbox && obj.pdfMeta?.type !== "text");

  objectsToRemove.forEach((obj) => canvas.remove(obj));
  console.log(`🧹 [Clear] Removed ${objectsToRemove.length} user objects`);
};

export const loadPageState = async (
  pageKey: string | number,
  pdfOverlayFabricRef: React.RefObject<Canvas | null>,
  pageCanvasData: Record<string, string>
): Promise<void> => {
  const canvas = pdfOverlayFabricRef.current;

  if (!canvas) {
    console.warn("⚠️ [Load] No canvas available yet");
    return;
  }

  const savedData = pageCanvasData[pageKey as any];

  // 1. Always remove existing user objects first
  clearNonTextObjects(canvas);

  // 2. If no saved data, render and exit
  if (!savedData) {
    canvas.renderAll();
    console.log(`📭 [Load] No saved data for key ${pageKey}`);
    return;
  }

  try {
    const data = JSON.parse(savedData);
    if (!data || !data.objects || data.objects.length === 0) {
      canvas.renderAll();
      return;
    }

    console.log(
      `📥 [Load] Enlivening ${data.objects.length} objects for key ${pageKey}...`
    );

    // Enliven all objects at once
    const enlivenedObjects = await util.enlivenObjects(data.objects);

    // Add all objects to canvas
    enlivenedObjects.forEach((obj: any) => {
      canvas.add(obj);
    });

    // Ensure hitboxes stay at the back
    const hitboxes = canvas
      .getObjects()
      .filter((o: any) => o.isHitbox || o.pdfMeta?.type === "text");
    hitboxes.forEach((box) => canvas.sendObjectToBack(box));

    canvas.renderAll();
    console.log(`✅ [Load] Page ${pageKey} state restored`);
  } catch (err) {
    console.error(
      `❌ [Load] Failed to enliven objects for key ${pageKey}:`,
      err
    );

    // Fallback: use loadFromJSON
    try {
      console.log(`🔄 [Load] Falling back to loadFromJSON...`);
      await canvas.loadFromJSON(savedData);

      // Re-clear any hitboxes that might have been serialized by mistake
      const badHitboxes = canvas
        .getObjects()
        .filter((o: any) => o.type === "pdf-text" && !o.pdfMeta);
      badHitboxes.forEach((o) => canvas.remove(o));

      canvas.renderAll();
      console.log(`✅ [Load] Fallback successful for key ${pageKey}`);
    } catch (fallbackErr) {
      console.error(`❌ [Load] Fallback also failed for key ${pageKey}`);
      canvas.renderAll();
    }
  }
};

/* utility: wait until pdfOverlayFabricRef.current exists and has correct size */
export const waitForCanvasReady = async (
  timeout = 1000,
  interval = 50,
  pdfOverlayFabricRef: React.RefObject<Canvas | null>,
  pdfSize: { width: number; height: number }
) => {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      const canvas = pdfOverlayFabricRef.current;
      if (canvas && pdfSize.width && pdfSize.height) {
        return resolve();
      }
      if (Date.now() - start > timeout) {
        return reject(new Error("Canvas not ready (timeout)"));
      }
      setTimeout(check, interval);
    };
    check();
  });
};
