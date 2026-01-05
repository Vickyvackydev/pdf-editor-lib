import React, { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { pdfjs } from "react-pdf";

// Ensure worker is set up (though it's set in PdfEditor, safety check)
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
}

interface SearchResult {
  page: number;
  match: string;
  index: number; // Index in the items array (not char index)
  item: any;
}

export const SearchSidebar = ({
  pdfDocument,
  onResultClick,
}: {
  pdfDocument: any;
  onResultClick: (page: number, item: any) => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !pdfDocument) return;

    setIsSearching(true);
    setResults([]);
    const found: SearchResult[] = [];

    try {
      const numPages = pdfDocument.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();

        // Simple search: check each text item
        // A robust search would reconstruct the full string, but for now we search items.
        // This finds words/phrases within a single text block.
        textContent.items.forEach((item: any, idx: number) => {
          if (item.str.toLowerCase().includes(query.toLowerCase())) {
            found.push({
              page: i,
              match: item.str,
              index: idx,
              item: item,
            });
          }
        });
      }
      setResults(found);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      <div className="p-3 border-b border-gray-200 bg-white">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
          Search
        </label>
        <div className="relative">
          <input
            type="text"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Find in document..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Search
            className="absolute left-2.5 top-2.5 text-gray-400"
            size={16}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center pt-8 text-gray-500">
            <Loader2 className="animate-spin mb-2" size={24} />
            <span className="text-sm">Searching...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {results.length === 0 && query && (
              <div className="text-center text-sm text-gray-500 py-4">
                No results found
              </div>
            )}
            {results.map((res, idx) => (
              <button
                key={idx}
                onClick={() => onResultClick(res.page, res.item)}
                className="w-full text-left p-2 hover:bg-white hover:shadow-sm rounded transition-all text-sm group border border-transparent hover:border-gray-200"
              >
                <div className="font-semibold text-gray-700 text-xs mb-0.5">
                  Page {res.page}
                </div>
                <div
                  className="text-gray-600 line-clamp-2 break-all text-xs"
                  title={res.match}
                >
                  ...{res.match}...
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
