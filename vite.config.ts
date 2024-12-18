import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { templateCompilerOptions } from '@tresjs/core'

export default defineConfig({
  base: '/treer/',
  plugins: [vue({ ...templateCompilerOptions }), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
  },
  // 添加静态资源处理配置
  assetsInclude: ['**/*.gltf', '**/*.glb'], // 添加对 gltf/glb 文件的支持
})
