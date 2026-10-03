import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// 개발 서버에서는 @vitejs/plugin-react 가 인라인 스크립트(preamble)를 넣어 CSP 와 충돌 → dev 에서만 CSP meta 제거
const stripCspInDev = (): Plugin => ({
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: html => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, ''),
})

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), stripCspInDev()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) }
  }
})
