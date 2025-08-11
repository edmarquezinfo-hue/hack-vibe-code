import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc' // Add this

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
    build: {
        minify: 'esbuild', // This is the default and fastest option
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                // Group all node_modules into a vendor chunk
                return 'vendor'; 
              }
            },
          },
        },
    },
	plugins: [react(),  
        cloudflare({
          configPath: "wrangler.jsonc",
          experimental: { remoteBindings: true },
        }),
        tailwindcss()],
	resolve: {
	  alias: {
		"@": path.resolve(__dirname, "./src"),
	  },
	},
	// Configure for Prisma + Cloudflare Workers compatibility
	define: {
		// Ensure proper module definitions for Cloudflare Workers context  
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
		global: 'globalThis',
        // '__filename': '""',
        // '__dirname': '""',
	},
	worker: {
		// Handle Prisma in worker context for development
		format: 'es'
	},
	server: {
		allowedHosts: ['localhost', '127.0.0.1', 'build.chat.cloudflare.dev', 'orange_build.eti-india.workers.dev', 'build.ashishkumarsingh.com', 'build.cloudflare.dev']
	},
});
