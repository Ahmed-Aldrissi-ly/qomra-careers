import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({base:process.env.PUBLIC_BASE_PATH||'/',plugins:[react()],build:{rollupOptions:{input:{apply:resolve('index.html'),team:resolve('team/index.html'),privacy:resolve('privacy/index.html')}}}});
