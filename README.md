# PDF Editor Library

A powerful, responsive, and easy-to-use PDF Editor component for React applications. Built with `react-pdf`, `pdf-lib`, and `fabric.js`.

## Features

- **Full PDF Editing**: Add text, drawings, shapes, and images to any PDF page.
- **Page Management**: Reorder, duplicate, and delete pages using drag-and-drop.
- **Undo/Redo**: Full history support for all actions.
- **Responsive Design**: Mobile-friendly interface with collapsible sidebar and adaptive toolbar.
- **Customizable**: Pass initial file URL, file name, and handle save/back actions.
- **Version History**: Auto-saves versions in local storage for easy restoration.

## Installation

```bash
npm install @vicky-dev/pdf-editor-lib
```

## Usage

Import the component and the CSS file in your React application:

```tsx
import React, { useState } from "react";
import PdfEditor, { ToastContainer } from "@vicky-dev/pdf-editor-lib";
import "@vicky-dev/pdf-editor-lib/dist/pdf-editor-lib.css";

function App() {
  const [showEditor, setShowEditor] = useState(true);

  const handleSave = (pdfBytes: Uint8Array, fileName: string) => {
    // You can upload the bytes to your server here
    console.log("Saved PDF!", pdfBytes.byteLength);

    // Or trigger a download manually if you want custom behavior
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  };

  const handleBack = () => {
    console.log("Back button clicked");
    setShowEditor(false);
  };

  if (!showEditor)
    return <button onClick={() => setShowEditor(true)}>Open Editor</button>;

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <ToastContainer />
      <PdfEditor
        fileUrl="https://pdfobject.com/pdf/sample.pdf" // Optional: Load a PDF by default
        fileName="MyDocument.pdf" // Optional: Default filename
        onSave={handleSave} // Optional: Handle save action
        onBack={handleBack} // Optional: Show back button
      />
    </div>
  );
}

export default App;
```

## Props

| Prop       | Type                                               | Description                                                                                                                                                                               |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fileUrl`  | `string`                                           | (Optional) URL of the PDF to load initially.                                                                                                                                              |
| `fileName` | `string`                                           | (Optional) Default name for the file when saving. Defaults to "Document.pdf".                                                                                                             |
| `onSave`   | `(pdfBytes: Uint8Array, fileName: string) => void` | (Optional) Callback triggered when the user clicks "Save Document". If provided, a "Save Document" button appears in the dropdown. The default "Download PDF" option is always available. |
| `onBack`   | `() => void`                                       | (Optional) Callback triggered when the user clicks the "Back" button in the header. If not provided, the back button is hidden.                                                           |

## License

MIT
