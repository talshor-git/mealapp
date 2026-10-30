import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// base: "./" מייצר נתיבים יחסיים כך שהאתר עובד תחת
// https://<user>.github.io/<repo>/ ללא תלות בשם המאגר.
export default defineConfig({
  base: "./",
  plugins: [react(), {
    name: "app-version",
    generateBundle() {
      const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
      this.emitFile({ type:"asset", fileName:"version.json", source:JSON.stringify({ version }) });
    },
  }],
});
