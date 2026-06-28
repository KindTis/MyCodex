import { createRoot } from "react-dom/client";
import { SettingsDialog } from "./SettingsDialog";
import "./overlay.css";

createRoot(document.getElementById("root") as HTMLElement).render(<SettingsDialog />);
