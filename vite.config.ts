import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: "/Payroll/",  // <--- Needs leading and trailing slashes
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  }
});