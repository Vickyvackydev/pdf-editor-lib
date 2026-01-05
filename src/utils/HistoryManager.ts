export interface Version {
  id: string;
  versionNumber: number; // Explicit version number (v1, v2, v3...)
  timestamp: number;
  label: string;
  data: Record<string, string>; // pageId -> canvas JSON
  preview?: string; // Optional base64 thumbnail for preview
}

const STORAGE_KEY = "pdf-editor-versions";

export const HistoryManager = {
  getVersions(pdfId: string): Version[] {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const versions = all[pdfId] || [];

      // Backward compatibility: auto-assign version numbers to old versions
      return versions.map((v: any, index: number) => ({
        ...v,
        versionNumber: v.versionNumber ?? versions.length - index,
      }));
    } catch (e) {
      console.error("Failed to load versions", e);
      return [];
    }
  },

  saveVersion(
    pdfId: string,
    data: Record<number, string>,
    label?: string,
    preview?: string
  ) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const versions = all[pdfId] || [];

      // Calculate next version number
      const versionNumber =
        versions.length > 0
          ? Math.max(...versions.map((v: any) => v.versionNumber || 0)) + 1
          : 1;

      const newVersion: Version = {
        id: crypto.randomUUID(),
        versionNumber,
        timestamp: Date.now(),
        label: label || `Version ${versionNumber}`,
        data,
        preview,
      };

      // Keep max 10 versions per PDF
      const updatedVersions = [newVersion, ...versions].slice(0, 10);

      all[pdfId] = updatedVersions;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return newVersion;
    } catch (e) {
      console.error("Failed to save version", e);
      if (e instanceof Error && e.name === "QuotaExceededError") {
        console.error(
          "LocalStorage quota exceeded. Consider clearing old versions."
        );
      }
      return null;
    }
  },

  loadVersion(pdfId: string, versionId: string): Version | null {
    const versions = this.getVersions(pdfId);
    return versions.find((v) => v.id === versionId) || null;
  },

  getLatestVersion(pdfId: string): Version | null {
    const versions = this.getVersions(pdfId);
    if (versions.length === 0) return null;

    // Return version with highest version number
    return versions.reduce((latest, current) =>
      current.versionNumber > latest.versionNumber ? current : latest
    );
  },

  clearHistory(pdfId: string) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      delete all[pdfId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.error("Failed to clear history", e);
    }
  },
};

// Helper function for UI: Get relative time string
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  // Fall back to date for older versions
  return new Date(timestamp).toLocaleDateString();
}
