import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5173
	},
	ssr: {
		// Native modules must not be bundled by Vite/Rollup.
		external: ['better-sqlite3', '@node-rs/argon2']
	},
	optimizeDeps: {
		exclude: ['better-sqlite3', '@node-rs/argon2']
	}
});
