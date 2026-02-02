import { Toaster } from "react-hot-toast";
import { useState } from "react";
import PdfEditor from "../components/PdfEditor";

function DemoEditor() {
  const [showEditor, setShowEditor] = useState(false);

  const handleSave = (pdfBytes: Uint8Array, fileName: string) => {
    console.log("Saved PDF bytes:", pdfBytes.length);

    // Trigger actual download
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(
      `Saved ${fileName} with ${pdfBytes.length} bytes! Check console for details.`,
    );
  };

  const handleBack = () => {
    setShowEditor(false);
  };

  if (showEditor) {
    return (
      <>
        <Toaster position="top-left" />
        <PdfEditor
          onSave={handleSave}
          onBack={handleBack}
          // You can pass a fileUrl here if you want to preload one
          // fileUrl="https://pdfobject.com/pdf/sample.pdf"
        />
      </>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6">My App Integration</h1>
      <button
        onClick={() => setShowEditor(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition font-medium"
      >
        Open PDF Editor
      </button>
    </div>
  );
}

export default DemoEditor;
