import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 상대 경로 base: GitHub Pages 저장소 이름과 무관하게 동작
export default defineConfig({
  base: './',
  plugins: [react()],
})
