import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { randomBytes } from "node:crypto";
import { APP_BUILD_ID_PATTERN, APP_BUILD_META } from "./shared/appBuild";

// Chaque build porte un identifiant (APP_BUILD_ID, sinon aléatoire) que le serveur renvoie sur /api :
// un onglet chargé avant un déploiement détecte ainsi qu'il exécute un JS périmé.
function appBuildId(): Plugin {
  const id = process.env.APP_BUILD_ID?.trim() || `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  if (!APP_BUILD_ID_PATTERN.test(id)) throw new Error("APP_BUILD_ID must match " + APP_BUILD_ID_PATTERN);
  return {
    name: "app-build-id",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { name: APP_BUILD_META, content: id }, injectTo: "head" }],
  };
}

export default defineConfig({
  plugins: [
    react(),
    appBuildId(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
