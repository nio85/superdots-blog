/**
 * Inline consent-reader snippet.
 *
 * Runs synchronously in the document head (via <script is:inline set:html>)
 * and exposes a single `window.SD_readConsent()` that centralizes the
 * cookie-consent state lookup used by every analytics loader.
 *
 * Keeping this as a stringified snippet (rather than a normal module) means
 * it lands in the HTML verbatim and runs before anything else on the page —
 * required so analytics scripts can consult it synchronously at head time.
 *
 * Source order used when resolving consent:
 *   1. sd-consent-v2 (current cookie-consent implementation, v2 schema)
 *   2. cc_cookie (legacy CookieConsent-v3 JSON)
 *   3. sd-cookie-consent (legacy v1 boolean)
 * If none are present → analytics: false, marketing: false.
 *
 * Keeping this as a *module string* rather than hand-duplicating the body in
 * each analytics script was the whole point of Epic #3. See BaseHead.astro
 * for the consumers.
 */
export const consentInlineScript = `(() => {
	function read() {
		try {
			const raw = localStorage.getItem('sd-consent-v2');
			if (raw) {
				const p = JSON.parse(raw);
				if (p && p.version === 2 && new Date(p.expires).getTime() >= Date.now()) {
					return {
						analytics: !!(p.categories && p.categories.analytics),
						marketing: !!(p.categories && p.categories.marketing),
						source: 'v2',
					};
				}
			}
			const ccMatch = document.cookie.match(/(?:^|;\\s*)cc_cookie=([^;]*)/);
			if (ccMatch) {
				try {
					const cats = JSON.parse(decodeURIComponent(ccMatch[1])).categories || [];
					return {
						analytics: cats.indexOf('analytics') !== -1,
						marketing: cats.indexOf('marketing') !== -1,
						source: 'legacy-cookie',
					};
				} catch (e) {}
			}
			if (localStorage.getItem('sd-cookie-consent') === 'accepted') {
				return { analytics: true, marketing: false, source: 'legacy-v1' };
			}
		} catch (e) {}
		return { analytics: false, marketing: false, source: 'none' };
	}
	window.SD_readConsent = read;
	window.SD_isOptedOut = () => localStorage.getItem('sd-analytics-optout') === 'true';
})();`;
