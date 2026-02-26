import path from "path";
import fs from "fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const pkgJson = JSON.parse(
    fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
  );
  const appVersion = pkgJson.version || "dev";
  return {
    base: "/",
    preview: {
      port: 5173,
      allowedHosts: ["TERA_APP_URL"],
    },
    server: {
      port: 5173,
      host: "0.0.0.0",
    },
    define: {
      "import.meta.env.VITE_APP_TAG": JSON.stringify(appVersion),
      "import.meta.env.VITE_API_URL": "TERA_API_URL",
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
