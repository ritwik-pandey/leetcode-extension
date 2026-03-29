import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: 'src/ui/popup.js',
        leetcodecontent: 'src/leetcodeContent.js',
        leaderboard: 'src/ui/leaderboard.js',
        background: 'src/background.js'
      },
      output: {
        entryFileNames: '[name].js',
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
  }
});
