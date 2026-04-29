import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 相対パスを使用
  build: {
    assetsDir: '', // アセット（JS/CSS）をサブフォルダに入れず、ルートに直接出力
    outDir: 'dist',
    rollupOptions: {
      output: {
        // ファイル名にハッシュを付けず、固定の名前にする（CLIの認識漏れ防止）
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`
      }
    }
  }
});
