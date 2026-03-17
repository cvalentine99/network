import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// =============================================================================
// TELEMETRY ERADICATION (2026-03-16)
//
// The following were removed during hostile-source-truth repair:
//   - vite-plugin-manus-runtime (injected runtime script that read localStorage user data)
//   - vitePluginManusDebugCollector (sendBeacon telemetry: console, network, session replay)
//   - @builder.io/vite-plugin-jsx-loc (JSX location tracking, not needed for production)
//   - client/public/__manus__/debug-collector.js (821-line browser telemetry collector)
//
// No telemetry, no sendBeacon, no debug collectors, no runtime hooks remain.
// =============================================================================

const plugins = [react(), tailwindcss()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Rec 5: Vendor splitting — keep heavy libraries in their own chunks
        // so they are cached independently of application code.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('d3-') || id.includes('d3-force') || id.includes('d3-selection') || id.includes('d3-zoom') || id.includes('d3-drag')) {
              return 'vendor-d3';
            }
            if (id.includes('recharts') || id.includes('victory')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react-dom')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
