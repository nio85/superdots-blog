/**
 * Runtime tests for the consent-reader snippet.
 *
 * We create a fresh happy-dom Window per test (rather than reusing vitest's
 * shared environment) to fully isolate localStorage + document.cookie state.
 * Happy-dom's setter doesn't reliably clear same-name cookies between tests
 * when the setter is called without max-age/expires, which caused bleed in
 * an earlier single-window iteration.
 */
import { Window } from 'happy-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { consentInlineScript } from './consent-inline';

type ConsentResult = { analytics: boolean; marketing: boolean; source: string };
type TestWindow = {
	SD_readConsent: () => ConsentResult;
	SD_isOptedOut: () => boolean;
	localStorage: Storage;
	document: { cookie: string };
};

let win: TestWindow;

beforeEach(() => {
	const freshWindow = new Window();
	const w = freshWindow as unknown as Record<string, unknown>;
	globalThis.window = w as typeof globalThis.window;
	globalThis.document = w.document as typeof globalThis.document;
	globalThis.localStorage = w.localStorage as Storage;
	// biome-ignore lint/security/noGlobalEval: test fixture runs the production snippet in an isolated window
	eval(consentInlineScript);
	win = w as unknown as TestWindow;
});

describe('SD_readConsent — sd-consent-v2 (primary source)', () => {
	it('returns analytics:true and marketing:true when both granted', () => {
		const v2 = {
			version: 2,
			expires: new Date(Date.now() + 86400000).toISOString(),
			categories: { analytics: true, marketing: true },
		};
		win.localStorage.setItem('sd-consent-v2', JSON.stringify(v2));
		expect(win.SD_readConsent()).toEqual({ analytics: true, marketing: true, source: 'v2' });
	});

	it('returns analytics:true marketing:false when only analytics granted', () => {
		const v2 = {
			version: 2,
			expires: new Date(Date.now() + 86400000).toISOString(),
			categories: { analytics: true, marketing: false },
		};
		win.localStorage.setItem('sd-consent-v2', JSON.stringify(v2));
		expect(win.SD_readConsent()).toEqual({ analytics: true, marketing: false, source: 'v2' });
	});

	it('falls through when v2 is expired', () => {
		const expiredV2 = {
			version: 2,
			expires: new Date(Date.now() - 86400000).toISOString(),
			categories: { analytics: true },
		};
		win.localStorage.setItem('sd-consent-v2', JSON.stringify(expiredV2));
		expect(win.SD_readConsent().source).toBe('none');
		expect(win.SD_readConsent().analytics).toBe(false);
	});

	it('falls through when v2 version mismatches', () => {
		const badVersion = {
			version: 1,
			expires: new Date(Date.now() + 86400000).toISOString(),
			categories: { analytics: true },
		};
		win.localStorage.setItem('sd-consent-v2', JSON.stringify(badVersion));
		expect(win.SD_readConsent().source).toBe('none');
	});

	it('ignores malformed v2 JSON and continues the chain', () => {
		win.localStorage.setItem('sd-consent-v2', 'not-json');
		expect(win.SD_readConsent().source).toBe('none');
	});
});

describe('SD_readConsent — cc_cookie (legacy CookieConsent v3)', () => {
	it('reads analytics from categories array', () => {
		const payload = JSON.stringify({ categories: ['necessary', 'analytics'] });
		win.document.cookie = `cc_cookie=${encodeURIComponent(payload)}`;
		const c = win.SD_readConsent();
		expect(c.analytics).toBe(true);
		expect(c.marketing).toBe(false);
		expect(c.source).toBe('legacy-cookie');
	});

	it('reads marketing from categories array', () => {
		const payload = JSON.stringify({ categories: ['necessary', 'marketing'] });
		win.document.cookie = `cc_cookie=${encodeURIComponent(payload)}`;
		expect(win.SD_readConsent().marketing).toBe(true);
	});

	it('is preferred over sd-cookie-consent when both are set', () => {
		win.document.cookie = `cc_cookie=${encodeURIComponent(JSON.stringify({ categories: ['necessary'] }))}`;
		win.localStorage.setItem('sd-cookie-consent', 'accepted');
		// cc_cookie (no analytics) wins over sd-cookie-consent ('accepted' would have meant analytics)
		expect(win.SD_readConsent().analytics).toBe(false);
		expect(win.SD_readConsent().source).toBe('legacy-cookie');
	});
});

describe('SD_readConsent — sd-cookie-consent (legacy v1)', () => {
	it('treats "accepted" as analytics-only', () => {
		win.localStorage.setItem('sd-cookie-consent', 'accepted');
		expect(win.SD_readConsent()).toEqual({ analytics: true, marketing: false, source: 'legacy-v1' });
	});

	it('ignores other values', () => {
		win.localStorage.setItem('sd-cookie-consent', 'rejected');
		expect(win.SD_readConsent().analytics).toBe(false);
		expect(win.SD_readConsent().source).toBe('none');
	});
});

describe('SD_readConsent — deny-by-default', () => {
	it('returns analytics:false marketing:false when nothing is set', () => {
		expect(win.SD_readConsent()).toEqual({ analytics: false, marketing: false, source: 'none' });
	});
});

describe('SD_isOptedOut', () => {
	it('returns true when sd-analytics-optout is the string "true"', () => {
		win.localStorage.setItem('sd-analytics-optout', 'true');
		expect(win.SD_isOptedOut()).toBe(true);
	});

	it('returns false when unset', () => {
		expect(win.SD_isOptedOut()).toBe(false);
	});

	it('returns false for any value other than "true"', () => {
		win.localStorage.setItem('sd-analytics-optout', '1');
		expect(win.SD_isOptedOut()).toBe(false);
	});
});
