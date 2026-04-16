/// <reference path="../.astro/types.d.ts" />

declare global {
	interface Window {
		umami?: {
			track: (event: string, data?: Record<string, unknown>) => void;
			identify?: (data: Record<string, unknown>) => void;
		};
	}
}

export {};