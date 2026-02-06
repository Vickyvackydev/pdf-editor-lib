import { type RefObject } from "react";

import { Document, Page } from "react-pdf";
import {
  handleEditPdfText,
  handleMaskPdfText,
  handleReplacePdfText,
} from "../utils/functions";
import type { Canvas } from "fabric";

interface ContextMenu {
  x: number;
  y: number;
  text: any | null;
}
export const PDFBody = ({
  zoom,
  viewerRef,
  pdfPageRef,
  pdfOverlayContainerRef,
  fileUrl,
  handleDocumentLoad,
  handlePageOnloadSuccess,
  pageNumber,
  contextMenu,
  pdfOverlayFabricRef,
  hideContextMenu,
  handleLoadError,
  children,
}: {
  currentPage: number;
  zoom: number;
  viewerRef: RefObject<HTMLDivElement>;
  pdfOverlayFabricRef: RefObject<Canvas | null>;
  pdfPageRef: RefObject<HTMLDivElement>;
  pdfOverlayContainerRef: RefObject<HTMLDivElement>;
  fileUrl: string;
  handleDocumentLoad: any;
  handlePageOnloadSuccess: (page: any) => Promise<void>;
  pageNumber: number;
  contextMenu: ContextMenu;
  hideContextMenu: () => void;
  handleLoadError: (error: Error) => void;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className="w-full h-full overflow-auto bg-gray-100 dark:bg-gray-900/50 p-2 md:p-8 transition-colors"
      ref={viewerRef}
    >
      <div
        className="mx-auto bg-white shadow-lg relative transition-all"
        ref={pdfPageRef}
        style={{ maxWidth: "850px", width: "fit-content" }}
      >
        {/* PDF Viewer */}
        <Document
          file={fileUrl}
          onLoadSuccess={handleDocumentLoad}
          onLoadError={(err) => handleLoadError(err as Error)}
        >
          <Page
            key={pageNumber}
            pageNumber={pageNumber}
            onRenderSuccess={handlePageOnloadSuccess}
            onRenderError={(err) => handleLoadError(err as Error)}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            scale={zoom / 100}
          />
        </Document>
        {contextMenu.text && (
          <div
            className="absolute bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-md p-2 text-sm z-50 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() =>
                handleEditPdfText(
                  contextMenu.text,
                  pdfOverlayFabricRef,
                  hideContextMenu,
                )
              }
              className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left rounded-md text-gray-700 dark:text-gray-200"
            >
              Edit Text
            </button>

            <button
              onClick={() =>
                handleMaskPdfText(
                  contextMenu.text,
                  pdfOverlayFabricRef,
                  hideContextMenu,
                )
              }
              className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left rounded-md text-gray-700 dark:text-gray-200"
            >
              Mask Text
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.text.str);
                hideContextMenu();
              }}
              className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left rounded-md text-gray-700 dark:text-gray-200"
            >
              Copy Text
            </button>

            <button
              onClick={() =>
                handleReplacePdfText(
                  contextMenu.text,
                  pdfOverlayFabricRef,
                  hideContextMenu,
                )
              }
              className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left rounded-md text-gray-700 dark:text-gray-200"
            >
              Replace Text
            </button>
          </div>
        )}

        {/* OVERLAY ON TOP */}
        <div
          className="absolute top-0 left-0 z-30 w-full h-full pointer-events-auto"
          ref={pdfOverlayContainerRef}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
          }}
        />
        {children}
      </div>
    </div>
  );
};
