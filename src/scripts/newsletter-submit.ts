const BUTTON_LABELS: Record<string, string> = {
	banner: 'Subscribe',
	inline: 'Send it to me',
	compact: 'Subscribe free',
	hero: 'Join free',
	midpost: 'Send me the workflow',
};

function getVariant(el: HTMLFormElement): string {
	const container = el.closest('.newsletter') as HTMLElement | null;
	const cls = container ? Array.from(container.classList).find((c) => c.startsWith('newsletter--')) : null;
	return cls ? cls.replace('newsletter--', '') : 'unknown';
}

document.querySelectorAll('.newsletter-form').forEach((form) => {
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const el = e.currentTarget as HTMLFormElement;
		const input = el.querySelector('input[type="email"]') as HTMLInputElement;
		const btn = el.querySelector('button[type="submit"]') as HTMLButtonElement;
		const status = el.querySelector('.newsletter-status') as HTMLElement;
		const source = el.closest('.newsletter')?.getAttribute('data-source') || 'unknown';

		const email = input.value.trim();
		if (!email) return;

		btn.disabled = true;
		btn.textContent = 'Sending...';
		status.textContent = '';
		status.className = 'newsletter-status';

		try {
			const res = await fetch('/api/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, source }),
			});
			const data = await res.json();

			if (res.ok) {
				status.textContent = 'Check your inbox to confirm your subscription.';
				status.classList.add('newsletter-status--success');
				input.value = '';

				if (typeof window.gtag === 'function') {
					window.gtag('event', 'generate_lead', {
						event_category: 'newsletter',
						event_label: source,
						value: 1,
					});
				}

				const variant = getVariant(el);
				if (typeof window.umami !== 'undefined') {
					window.umami.track('newsletter_signup', { source, variant, path: location.pathname });
				}
			} else {
				status.textContent = data.error || 'Something went wrong. Please try again.';
				status.classList.add('newsletter-status--error');
			}
		} catch {
			status.textContent = 'Network error. Please try again.';
			status.classList.add('newsletter-status--error');
		} finally {
			btn.disabled = false;
			btn.textContent = BUTTON_LABELS[getVariant(el)] || 'Subscribe';
		}
	});
});
