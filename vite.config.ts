import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', '');
  const buildIdentifier = environment.VERCEL_GIT_COMMIT_SHA ?? new Date().toISOString();

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(buildIdentifier),
    },
  };
});
