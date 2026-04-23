import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.{test,spec}.{ts,js}'],
		exclude: ['node_modules/**', 'dist/**', '.astro/**'],
		environment: 'node',
		globals: false,
		coverage: {
			reporter: ['text', 'html'],
			include: ['src/lib/**', 'src/utils/**'],
			exclude: ['**/*.test.ts', '**/*.spec.ts'],
		},
	},
});
