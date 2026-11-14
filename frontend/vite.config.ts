import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // Output to dist/ (Vercel default)
    outDir: 'dist',
    // Increase chunk warning limit — cytoscape is large
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split heavy libs into separate chunks for better caching
        manualChunks: {
          cytoscape: ['cytoscape', 'cytoscape-dagre', 'react-cytoscapejs'],
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
