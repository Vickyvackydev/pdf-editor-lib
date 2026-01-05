import { Toaster } from "react-hot-toast";
import PdfEditor from "../components/PdfEditor";

function DemoEditor() {
  return (
    <>
      <Toaster position="top-left" />
      <PdfEditor />
    </>
  );
}

export default DemoEditor;
