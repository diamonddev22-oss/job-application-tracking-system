import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const EXTENSION_ROOT = resolve(__dirname);

// Manifest V3 needs predictable, non-hashed output paths so manifest.json can
// reference them directly (no plugin like @crxjs is used, to keep the build
// simple and dependency-light, matching the extension's intentionally small scope).
// `root` is set to `src/` so HTML entry outputs land at `sidepanel/sidepanel.html` and
// `options/options.html` (relative to root) instead of mirroring the full
// `src/...` source path.
//
// manifest.json's `host_permissions` is a static `<all_urls>` — it's not just about letting the
// backend fetch() bypass CORS anymore (which `<all_urls>` covers too, so there's no longer a need
// to derive it from VITE_API_BASE_URL — see api/client.ts, which still reads that env var directly
// via Vite's normal import.meta.env, unrelated to this file). It's also what
// chrome.webNavigation/chrome.webRequest need in background.ts to observe navigation and network
// activity on arbitrary job sites at all; see the top-of-file comment in background.ts.
export default defineConfig({
  root: resolve(EXTENSION_ROOT, 'src'),
  // Without this, Vite would look for .env files inside src/ (since that's `root` above) instead
  // of the conventional location next to package.json.
  envDir: EXTENSION_ROOT,
  publicDir: resolve(EXTENSION_ROOT, 'public'),
  build: {
    outDir: resolve(EXTENSION_ROOT, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(EXTENSION_ROOT, 'src/sidepanel/sidepanel.html'),
        options: resolve(EXTENSION_ROOT, 'src/options/options.html'),
        background: resolve(EXTENSION_ROOT, 'src/background.ts'),
        // Declaratively-injected content scripts can't be loaded as ES modules, so this must
        // build to a plain script with no import/export statements — see content.ts, which is
        // kept free of runtime imports (only type-only imports, erased at compile time) for
        // exactly that reason.
        content: resolve(EXTENSION_ROOT, 'src/content.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' || chunk.name === 'content' ? '[name].js' : 'assets/[name].js'),
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
