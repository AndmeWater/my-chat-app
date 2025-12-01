import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 假设你的 github 仓库名是 my-chat-app
export default defineConfig({
  plugins: [vue()],
  base: '/my-chat-app/', 
})
