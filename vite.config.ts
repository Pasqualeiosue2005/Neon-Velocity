import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Map 'three/addons' to the correct path in node_modules
      'three/addons': path.resolve(__dirname, 'node_modules/three/examples/jsm')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});