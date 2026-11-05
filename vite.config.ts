/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Demuxify Web",
        short_name: "Demuxify",
        description:
          "In-browser client-side music source separation and multi-track player powered by BS-RoFormer and WebGPU.",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // woff2: the bundled Bold faces (public/fonts/ subsets) are precached offline
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 35 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // signalsmith-stretch serializes its own class source (Function.prototype.toString)
    // into a blob AudioWorklet module at runtime. If esbuild pre-bundles it, class fields
    // are lowered to the `__publicField` helper, which does not exist inside the worklet
    // scope: the processor constructor throws, the 'ready' handshake never posts, and
    // the factory promise hangs forever (silent playbackRate fallback = pitch coupling).
    exclude: ["signalsmith-stretch"],
  },
  build: {
    // Production twin of the optimizeDeps guard above (that exclude is dev-only;
    // it never touches the Rollup build). Vite's default build target "modules"
    // includes safari14, which lacks ES2022 class fields: esbuild lowers them to
    // the module-scope __publicField helper (minified alias, e.g. `v(this,…)`).
    // signalsmith-stretch serializes its worklet processor source via
    // Function.prototype.toString into a Blob module; the helper is NOT in scope
    // there, the processor constructor throws inside the worklet, the 'ready'
    // handshake times out, and tempo/pitch silently degrade to the WSOLA/
    // playbackRate fallback (pitch coupling) — dev fine, `vite preview` broken.
    // es2022 keeps class fields native, so the serialized source is complete.
    target: "es2022",
    // Second production twin of the same guard: signalsmith-stretch's worklet
    // Blob is built from a string-literal template `(_scriptName=>${Module})()`
    // whose arrow parameter NAME binds the glue's same-named closure variable
    // inside the serialized source. esbuild minify (Vite's default) renames the
    // closure var (to `K`), leaving the literal parameter `_scriptName` — the
    // shipped Blob then calls an undefined name, the wasm Module() promise
    // never resolves, 'ready' never posts, and the engine falls back exactly
    // as above. esbuild has no reserved-name option; terser's does the job.
    minify: "terser",
    terserOptions: {
      mangle: {
        reserved: ["_scriptName"],
      },
    },
  },
  server: {
    host: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  preview: {
    host: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**"],
  },
});
