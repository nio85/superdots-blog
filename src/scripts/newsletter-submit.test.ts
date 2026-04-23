// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bindNewsletterForm } from './newsletter-submit';

function createForm(variant = 'banner', source = 'test'): HTMLFormElement {
	const container = document.createElement('div');
	container.className = `newsletter newsletter--${variant}`;
	container.setAttribute('data-source', source);

	const form = document.createElement('form');
	form.className = 'newsletter-form';

	const input = document.createElement('input');
	input.type = 'email';
	input.value = 'test@example.com';

	const btn = document.createElement('button');
	btn.type = 'submit';
	btn.textContent = 'Subscribe';

	const status = document.createElement('div');
	status.className = 'newsletter-status';

	form.append(input, btn, status);
	container.append(form);
	document.body.append(container);

	return form;
}

describe('bindNewsletterForm', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('sends correct POST to /api/subscribe', async () => {
		const form = createForm();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({}),
		});
		vi.stubGlobal('fetch', fetchMock);

		bindNewsletterForm(form, { source: 'homepage' });
		form.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

		expect(fetchMock).toHaveBeenCalledWith('/api/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', source: 'homepage' }),
		});
	});

	it('shows success message and clears input on 200', async () => {
		const form = createForm();
		const input = form.querySelector('input[type="email"]') as HTMLInputElement;
		const status = form.querySelector('.newsletter-status') as HTMLElement;

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({}),
		}));

		bindNewsletterForm(form, { source: 'test' });
		form.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => expect(status.textContent).toBe('Check your inbox to confirm your subscription.'));
		expect(status.classList.contains('newsletter-status--success')).toBe(true);
		expect(input.value).toBe('');
	});

	it('shows error message on non-2xx response', async () => {
		const form = createForm();
		const status = form.querySelector('.newsletter-status') as HTMLElement;

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			json: () => Promise.resolve({ error: 'Email already subscribed.' }),
		}));

		bindNewsletterForm(form, { source: 'test' });
		form.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => expect(status.textContent).toBe('Email already subscribed.'));
		expect(status.classList.contains('newsletter-status--error')).toBe(true);
	});

	it('shows network error when fetch throws', async () => {
		const form = createForm();
		const status = form.querySelector('.newsletter-status') as HTMLElement;

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		bindNewsletterForm(form, { source: 'test' });
		form.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => expect(status.textContent).toBe('Network error. Please try again.'));
		expect(status.classList.contains('newsletter-status--error')).toBe(true);
	});

	it('restores button text from defaultText option', async () => {
		const form = createForm();
		const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({}),
		}));

		bindNewsletterForm(form, { source: 'test', defaultText: 'Count me in' });
		form.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => expect(btn.disabled).toBe(false));
		expect(btn.textContent).toBe('Count me in');
	});
});
