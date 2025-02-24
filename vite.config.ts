import webExtension from '@samrum/vite-plugin-web-extension'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { getManifest } from './manifest.config'

const dev = process.env.NODE_ENV === 'development'

export const outDir = dev ? 'dist/dev' : 'dist/build'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir,
  },
  plugins: [
    tsconfigPaths(),
    react(),
    vanillaExtractPlugin(),
    webExtension({
      additionalInputs: {
        html: ['src/index.html', 'src/design-system/playground/index.html'],
      },
      manifest: getManifest({ dev }),
    }),
  ],
})
