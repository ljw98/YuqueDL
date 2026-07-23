import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

// Web console only needs the download engine entry (not CLI).
export default defineConfig({
  input: {
    index: 'src/index.ts',
  },
  output: [
    {
      format: 'es',
      dir: 'dist/es',
    },
  ],
  plugins: [
    typescript(),
    terser(),
  ],
})
