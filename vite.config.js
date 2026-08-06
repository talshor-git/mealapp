import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" מייצר נתיבים יחסיים כך שהאתר עובד תחת
// https://<user>.github.io/<repo>/ ללא תלות בשם המאגר.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
