import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const pkgJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
  const appVersion = env.VITE_APP_TAG || pkgJson.version || 'dev';
  return {
    base: "/",
    preview: {
      port: 5173,
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
