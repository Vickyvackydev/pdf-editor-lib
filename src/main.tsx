import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DemoEditor from "./demo/DemoEditor";
import "./index.css";
// import App from './App.tsx'

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoEditor />
  </StrictMode>
);
