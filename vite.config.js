import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// Native addon — don't bundle it. On Vercel it's never called (DATABASE_URL
		// is set so the SQLite path is never taken). On Node/VPS it loads fine at runtime.
		external: ['better-sqlite3']
	}
});
