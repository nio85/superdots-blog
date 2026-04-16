/**
 * Article engagement tracking for Umami.
 *
 * Fires custom events on blog articles:
 *   - reading_progress  { milestone: 25 | 50 | 75 | 100 }  — scroll depth
 *   - reading_time      { seconds: 30 | 90 }                — dwell time with tab visible
 *   - outbound_click    { url, from_path }                  — click on external link
 *
 * Each event carries article context (slug/department/useCase) from body data-* attrs.
 */

type ArticleMeta = {
	slug: string;
	department: string;
	useCase: string;
};

function getArticleMeta(): ArticleMeta | null {
	const body = document.body;
	const slug = body.getAttribute('data-article-slug');
	if (!slug) return null;
	return {
		slug,
		department: body.getAttribute('data-article-department') || '',
		useCase: body.getAttribute('data-article-use-case') || '',
	};
}

function track(event: string, data: Record<string, unknown>) {
	if (typeof window.umami === 'undefined') return;
	window.umami.track(event, data);
}

function initScrollMilestones(meta: ArticleMeta) {
	const milestones = [25, 50, 75, 100] as const;
	const fired = new Set<number>();
	let ticking = false;

	const check = () => {
		ticking = false;
		const docEl = document.documentElement;
		const scrollable = docEl.scrollHeight - docEl.clientHeight;
		if (scrollable <= 0) return;
		const pct = Math.round((window.scrollY / scrollable) * 100);
		for (const m of milestones) {
			if (pct >= m && !fired.has(m)) {
				fired.add(m);
				track('reading_progress', { milestone: m, ...meta });
			}
		}
	};

	window.addEventListener(
		'scroll',
		() => {
			if (ticking) return;
			ticking = true;
			window.requestAnimationFrame(check);
		},
		{ passive: true },
	);
}

function initDwellTime(meta: ArticleMeta) {
	const thresholds = [30, 90] as const;
	const fired = new Set<number>();
	let accumulatedMs = 0;
	let lastTick = performance.now();

	const tick = () => {
		if (document.visibilityState === 'visible') {
			const now = performance.now();
			accumulatedMs += now - lastTick;
			lastTick = now;
			const seconds = Math.floor(accumulatedMs / 1000);
			for (const t of thresholds) {
				if (seconds >= t && !fired.has(t)) {
					fired.add(t);
					track('reading_time', { seconds: t, ...meta });
				}
			}
		} else {
			lastTick = performance.now();
		}
	};

	setInterval(tick, 5000);
	document.addEventListener('visibilitychange', () => {
		lastTick = performance.now();
	});
}

function initOutboundClicks(meta: ArticleMeta) {
	document.addEventListener(
		'click',
		(e) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;
			const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
			if (!anchor) return;
			const href = anchor.getAttribute('href') || '';
			if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
			let url: URL;
			try {
				url = new URL(anchor.href);
			} catch {
				return;
			}
			if (url.host === location.host) return;
			track('outbound_click', {
				url: anchor.href,
				from_path: location.pathname,
				...meta,
			});
		},
		{ capture: true },
	);
}

function init() {
	const meta = getArticleMeta();
	if (!meta) return;
	initScrollMilestones(meta);
	initDwellTime(meta);
	initOutboundClicks(meta);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
