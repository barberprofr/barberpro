import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    fs: {
      allow: ["./client", "./shared", "/."],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
    chunkSizeWarningLimit: 2000,
    output: {
      // Optimisation des chunks pour la production
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'state-management': ['@tanstack/react-query'],
        'ui-vendor': ['framer-motion', 'lucide-react'],
        'charts-vendor': ['recharts'],
        'utils-vendor': ['clsx', 'tailwind-merge', 'date-fns']
      }
    }
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  publicDir: "public",
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      const { createServer, connectDatabase } = await import("./server/index");
      // Connexion à la base de données en mode dev
      await connectDatabase();
      const app = createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
