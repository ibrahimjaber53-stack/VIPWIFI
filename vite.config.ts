import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const cleanHtmlPlugin = {
  name: 'clean-html-for-webview',
  transformIndexHtml(html: string) {
    return html
      .replace(/type="module"\s*/g, '')
      .replace(/crossorigin\s*/g, '')
      .replace(/crossorigin=""\s*/g, '')
      .replace(/<script\s+/g, '<script defer ');
  }
};

export default defineConfig(({ command }) => {
  return {
    base: './', // Enforce relative asset paths for seamless offline WebView and APK loading
    plugins: [
      react(),
      tailwindcss(),
      command === 'build' ? cleanHtmlPlugin : null
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: '', // Output assets directly in dist/ root
      rollupOptions: {
        output: {
          // Force JS and CSS outputs to be fixed named app.js / style.css without folder depth or hashes
          inlineDynamicImports: true,
          format: 'iife',
          entryFileNames: 'app.js',
          chunkFileNames: 'app.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'style.css';
            }
            return '[name].[ext]';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
