import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        balcao: resolve(__dirname, 'balcao.html'),
        caixa: resolve(__dirname, 'caixa.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        entregador: resolve(__dirname, 'entregador.html'),
        login: resolve(__dirname, 'login.html'),
        painelLoja: resolve(__dirname, 'painelLoja.html'),
        relatorios: resolve(__dirname, 'relatorios.html'),
        superadmin: resolve(__dirname, 'superadmin.html'),
        'alterar-senha': resolve(__dirname, 'alterar-senha.html'),
        cart: resolve(__dirname, 'view/cart.html'),
        whatsapp: resolve(__dirname, 'whatsapp.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/img': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
