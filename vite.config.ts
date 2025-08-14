import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
// import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
    // build: {
    //     rollupOptions: {
    //       output: {
    //             advancedChunks: {
    //                 groups: [{name: 'vendor', test: /node_modules/}]
    //             }
    //         }
    //     }
    // },
	plugins: [
        react(),  
        cloudflare({
          configPath: "wrangler.jsonc",
          experimental: { remoteBindings: true },
        }),
        tailwindcss(),
        // Add the node polyfills plugin here
        // nodePolyfills({
        //     exclude: [
        //       'tty', // Exclude 'tty' module
        //     ],
        //     // We recommend leaving this as `true` to polyfill `global`.
        //     globals: {
        //         global: true,
        //     },
        // })
    ],
	resolve: {
	  alias: {
        // 'path': 'path-browserify',
        // Add this line to fix the 'debug' package issue
        'debug': 'debug/src/browser', 
		// "@": path.resolve(__dirname, "./src"),
        "@": new URL('./src', import.meta.url).pathname,
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
