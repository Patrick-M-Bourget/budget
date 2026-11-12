import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { budgetFilePlugin } from "./src/server/budgetFile.ts";

export default defineConfig({
  plugins: [react(), budgetFilePlugin()],
  // Local-only, fixed port: fail rather than silently moving to another port.
  server: { host: "127.0.0.1", port: 4747, strictPort: true },
});
