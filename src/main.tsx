import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { LangProvider } from "./i18n.tsx";
import { ensurePersistentStorage } from "./persist";


// Request durable storage before mounting so local data survives.
void ensurePersistentStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);
