import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // @ts-expect-error — reactCompilerPreset() is a RolldownBabelPreset, consumed by the react() plugin internals
    react({ presets: [reactCompilerPreset()] }),
  ],
})
